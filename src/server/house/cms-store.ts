import { invalidateCommentObjectCache, type Database } from "emdash";
import { sql, type Kysely } from "kysely";
import { Schema } from "effect";
import type { CreatedGift, Gift, GiftDetail, HouseSnapshot, Viewer } from "../../lib/house/types";
import { findEmoji } from "../../lib/house/emoji";
import { CreateGiftSchema, UpdateGiftSchema } from "./schemas";
import { failure } from "./errors";
import { digest } from "./cms-schema";
import { takeQuota } from "./rate-limit";
import { moderateWithClef } from "./clef";

type CommentRow = {
  id: string;
  collection: string;
  content_id: string;
  parent_id: string | null;
  author_name: string;
  author_email: string;
  author_user_id: string | null;
  body: string;
  status: string;
  moderation_metadata: string | null;
  created_at: string;
  updated_at: string;
};

type Receipt = { id: string; author_id: string; fingerprint: string };

export class CmsHouseStore {
  constructor(private readonly db: Kysely<Database>) {}

  async initialize(): Promise<void> {
    // Ensure comments are enabled for the things collection where the guestbook lives
    await sql`UPDATE _emdash_collections SET comments_enabled = 1 WHERE slug IN ('things', 'gifts')`.execute(this.db);

    await sql`CREATE TABLE IF NOT EXISTS house_gift_receipts (
      id TEXT PRIMARY KEY, author_id TEXT NOT NULL, fingerprint TEXT NOT NULL
    )`.execute(this.db);
  }

  async snapshot(viewer?: Viewer | null): Promise<HouseSnapshot> {
    let query = this.db
      .selectFrom("_emdash_comments as c")
      .selectAll()
      .where("collection", "in", ["things", "gifts"])
      .where("content_id", "in", ["leave-gift", "guestbook"]);

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

    const rows = (await query.orderBy("created_at", "asc").execute()) as unknown as CommentRow[];

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
    const clefDecision = await moderateWithClef(command.message, command.authorName);
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

      await sql`INSERT OR REPLACE INTO house_gift_receipts (id, author_id, fingerprint) VALUES (${id}, ${viewer.visitor.id}, ${fingerprint})`.execute(this.db);

      invalidateCommentObjectCache();
    } catch (error) {
      const saved = await retry();
      if (saved) return saved;
      throw error;
    }

    return { ...(await this.snapshot(viewer)), createdGiftId: id };
  }

  async detail(id: string, viewer: Viewer): Promise<GiftDetail> {
    const row = (await this.db
      .selectFrom("_emdash_comments")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()) as unknown as CommentRow | undefined;

    if (!row) throw failure(404, "This gift is no longer here.");
    const gift = commentToGift(row, viewer);
    const owns = Boolean(viewer.visitor?.id && row.author_user_id === viewer.visitor.id);

    return {
      ...gift,
      canEdit: owns || viewer.owner,
      canReclaim: owns || viewer.owner,
      canRemove: owns || viewer.owner,
    };
  }

  async update(id: string, input: unknown, viewer: Viewer): Promise<HouseSnapshot> {
    if (!viewer.visitor) throw failure(401, "Your visitor identity is needed for this action.");

    const row = (await this.db
      .selectFrom("_emdash_comments")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()) as unknown as CommentRow | undefined;

    if (!row) throw failure(404, "This gift is no longer here.");
    const owns = Boolean(viewer.visitor?.id && row.author_user_id === viewer.visitor.id);
    if (!owns && !viewer.owner) throw failure(403, "Only its author or Kaio can edit this gift.");

    let command: typeof UpdateGiftSchema.Type;
    try {
      command = Schema.decodeUnknownSync(UpdateGiftSchema)(input);
    } catch {
      throw failure(400, "Check the gift icon, name, and message (up to 400 characters) and try again.");
    }

    // Re-run Clef moderation on the updated message
    const clefDecision = await moderateWithClef(command.message, command.authorName);
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

    await this.db
      .updateTable("_emdash_comments")
      .set({
        author_name: command.authorName.trim(),
        body: command.message.trim(),
        status,
        moderation_metadata: JSON.stringify(metadata),
        updated_at: now,
      })
      .where("id", "=", id)
      .execute();

    invalidateCommentObjectCache();
    return this.snapshot(viewer);
  }

  async remove(id: string, viewer: Viewer): Promise<HouseSnapshot> {
    if (!viewer.visitor) throw failure(401, "Your visitor identity is needed for this action.");

    const row = (await this.db
      .selectFrom("_emdash_comments")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()) as unknown as CommentRow | undefined;

    if (!row) throw failure(404, "This gift is no longer here.");
    const owns = Boolean(viewer.visitor?.id && row.author_user_id === viewer.visitor.id);
    if (!owns && !viewer.owner) throw failure(403, "Only its author or Kaio can remove this gift.");

    await this.db.deleteFrom("_emdash_comments").where("id", "=", id).execute();

    invalidateCommentObjectCache();
    return this.snapshot(viewer);
  }
}

function commentToGift(row: CommentRow, viewer?: Viewer | null): Gift {
  let meta: Record<string, unknown> = {};
  try {
    if (row.moderation_metadata) meta = JSON.parse(row.moderation_metadata);
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
    status: (row.status === "approved" || row.status === "pending" ? row.status : "pending") as "approved" | "pending",
    createdAt: row.created_at || new Date().toISOString(),
    canEdit: isAuthor || Boolean(viewer?.owner),
    canDelete: isAuthor || Boolean(viewer?.owner),
  };
}
