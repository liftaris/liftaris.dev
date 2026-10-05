import { invalidateCommentObjectCache, type Database } from "emdash";
import { sql, type Kysely, type Selectable } from "kysely";
import { Schema } from "effect";
import type { CreatedGift, Gift, HouseSnapshot, Viewer } from "../../lib/house/types";
import { findEmoji } from "../../lib/house/emoji";
import { CreateGiftSchema, UpdateGiftSchema } from "./schemas";
import { failure } from "./errors";
import { digest } from "./digest";
import { takeQuota } from "./rate-limit";
import { moderateWithClef } from "./clef";

type CommentRow = Selectable<Database["_emdash_comments"]>;

type Receipt = { id: string; author_id: string; fingerprint: string };

export class CmsHouseStore {
  constructor(private readonly db: Kysely<Database>) {}

  private comments() {
    return this.db.selectFrom("_emdash_comments").selectAll()
      .where("collection", "=", "things")
      .where("content_id", "=", "leave-gift")
      .where("status", "in", ["approved", "pending"]);
  }

  private async editable(id: string, viewer: Viewer): Promise<CommentRow> {
    if (!viewer.visitor) throw failure(401, "Your visitor identity is needed for this action.");
    const row = await this.comments().where("id", "=", id).executeTakeFirst();
    if (!row) throw failure(404, "This gift is no longer here.");
    if (row.author_user_id !== viewer.visitor.id && !viewer.owner) {
      throw failure(403, "Only its author or Kaio can change this gift.");
    }
    return row;
  }

  async snapshot(viewer?: Viewer | null): Promise<HouseSnapshot> {
    let query = this.comments();

    if (viewer?.owner) {
      query = query.where("status", "in", ["approved", "pending"]);
    } else if (viewer?.visitor) {
      const visitorId = viewer.visitor.id;
      query = query.where((eb) =>
        eb.or([
          eb("status", "=", "approved"),
          eb.and([
            eb("status", "=", "pending"),
            eb("author_user_id", "=", visitorId),
          ]),
        ]),
      );
    } else {
      query = query.where("status", "=", "approved");
    }

    const rows = await query.orderBy("created_at", "asc").execute();

    const gifts: Gift[] = rows.map((row) => commentToGift(row, viewer));
    return { gifts };
  }

  async create(input: unknown, viewer: Viewer): Promise<CreatedGift> {
    if (!viewer.visitor) throw failure(401, "Your visitor identity is needed for this action.");

    let command: typeof CreateGiftSchema.Type;
    try {
      command = Schema.decodeUnknownSync(CreateGiftSchema)(input);
    } catch {
      throw failure(400, "Check the gift icon, name, and message (up to 400 characters) and try again.");
    }

    const id = `gift-${await digest(`${viewer.visitor.id}:${command.requestId}`)}`;
    const fingerprint = await digest(JSON.stringify(command));

    const retry = async (): Promise<CreatedGift | null> => {
      const { rows } = await sql<Receipt>`SELECT * FROM house_gift_receipts WHERE id = ${id}`.execute(this.db);
      if (!rows[0]) return null;
      if (rows[0].fingerprint !== fingerprint) {
        throw failure(409, "This request was already used for a different gift.");
      }
      return { ...(await this.snapshot(viewer)), createdGiftId: id };
    };

    const previous = await retry();
    if (previous) return previous;

    if (!viewer.owner && !(await takeQuota(this.db, `house:gifts:${viewer.visitor.id}`, 10))) {
      throw failure(429, "A few gifts at a time is plenty. Try again in a minute.");
    }

    // Moderate message using Cloudflare Clef decision model
    const clefDecision = await moderateWithClef(command.message, command.authorName, command.location);
    const status = clefDecision.approved ? "approved" : "pending";

    const emojiItem = findEmoji(command.emojiId);
    const emoji = emojiItem?.emoji || "🎁";

    const metadata = {
      submissionHash: fingerprint,
      emojiId: command.emojiId,
      emoji,
      location: command.location?.trim() || null,
      clefReason: clefDecision.reason,
    };

    const now = new Date().toISOString();

    try {
      await this.db
        .insertInto("_emdash_comments")
        .values({
          id,
          collection: "things",
          content_id: "leave-gift",
          parent_id: null,
          author_name: command.authorName.trim(),
          author_email: `${viewer.visitor.id}@visitors.invalid`,
          author_user_id: viewer.visitor.id,
          body: command.message.trim(),
          status,
          ip_hash: null,
          user_agent: null,
          moderation_metadata: JSON.stringify(metadata),
          created_at: now,
          updated_at: now,
        })
        .execute();

      invalidateCommentObjectCache();
    } catch (error) {
      const saved = await retry();
      if (saved) return saved;
      throw error;
    }

    return { ...(await this.snapshot(viewer)), createdGiftId: id };
  }

  async update(id: string, input: unknown, viewer: Viewer): Promise<HouseSnapshot> {
    const row = await this.editable(id, viewer);

    let command: typeof UpdateGiftSchema.Type;
    try {
      command = Schema.decodeUnknownSync(UpdateGiftSchema)(input);
    } catch {
      throw failure(400, "Check the gift icon, name, and message (up to 400 characters) and try again.");
    }

    if (!viewer.owner && !(await takeQuota(this.db, `house:gifts:${viewer.visitor!.id}`, 10))) {
      throw failure(429, "A few changes at a time is plenty. Try again in a minute.");
    }

    if (command.updatedAt !== row.updated_at) throw failure(409, "This message changed. Reload it before editing again.");

    // Re-run Clef moderation on all public fields
    const clefDecision = await moderateWithClef(command.message, command.authorName, command.location);
    const status = clefDecision.approved ? "approved" : "pending";

    const emojiItem = findEmoji(command.emojiId);
    const emoji = emojiItem?.emoji || "🎁";

    const metadata = {
      emojiId: command.emojiId,
      emoji,
      location: command.location?.trim() || null,
      clefReason: clefDecision.reason,
    };

    const now = new Date().toISOString();

    const updated = await this.db
      .updateTable("_emdash_comments")
      .set({
        author_name: command.authorName.trim(),
        body: command.message.trim(),
        status,
        moderation_metadata: JSON.stringify(metadata),
        updated_at: now,
      })
      .where("id", "=", id)
      .where("status", "=", row.status)
      .where("updated_at", "=", row.updated_at)
      .executeTakeFirst();
    if (!updated.numUpdatedRows) throw failure(409, "This message changed while saving. Reload it before trying again.");

    invalidateCommentObjectCache();
    return this.snapshot(viewer);
  }

  async remove(id: string, viewer: Viewer): Promise<HouseSnapshot> {
    const row = await this.editable(id, viewer);
    const removed = await this.db.updateTable("_emdash_comments")
      .set({ status: "trash", updated_at: new Date().toISOString() })
      .where("id", "=", id).where("status", "=", row.status).where("updated_at", "=", row.updated_at)
      .executeTakeFirst();
    if (!removed.numUpdatedRows) throw failure(409, "This message changed. Reload it before trying again.");

    invalidateCommentObjectCache();
    return this.snapshot(viewer);
  }
}

function commentToGift(row: CommentRow, viewer?: Viewer | null): Gift {
  let meta: Record<string, unknown> = {};
  try {
    if (row.moderation_metadata) {
      const parsed: unknown = JSON.parse(row.moderation_metadata);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) meta = parsed as Record<string, unknown>;
    }
  } catch {
    // ignore parse error
  }

  const emojiId = typeof meta.emojiId === "string" ? meta.emojiId : "gift";
  const emoji = typeof meta.emoji === "string" ? meta.emoji : findEmoji(emojiId)?.emoji || "🎁";
  const location = typeof meta.location === "string" ? meta.location : null;
  const isAuthor = Boolean(viewer?.visitor?.id && row.author_user_id === viewer.visitor.id);

  return {
    id: row.id,
    emojiId,
    emoji,
    authorName: row.author_name,
    location,
    message: row.body,
    status: row.status === "approved" ? "approved" : "pending",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canEdit: isAuthor || Boolean(viewer?.owner),
    canDelete: isAuthor || Boolean(viewer?.owner),
  };
}
