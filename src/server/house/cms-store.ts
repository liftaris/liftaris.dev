import { ContentRepository, type ContentItem, type Database } from "emdash";
import { sql, type Kysely } from "kysely";
import { Schema } from "effect";
import type { CreatedGift, Gift, GiftDetail, HouseSnapshot, Viewer } from "../../lib/house/types";
import { findEmoji } from "../../lib/house/emoji";
import { CreateGiftSchema, UpdateGiftSchema } from "./schemas";
import { failure } from "./errors";
import { digest, initializeGiftCollection } from "./cms-schema";
import { takeQuota } from "./rate-limit";

type Receipt = { id: string; author_id: string; fingerprint: string };

export class CmsHouseStore {
  private readonly content: ContentRepository;
  constructor(private readonly db: Kysely<Database>) { this.content = new ContentRepository(db); }

  initialize(): Promise<void> { return initializeGiftCollection(this.db); }

  async snapshot(): Promise<HouseSnapshot> {
    const gifts: Gift[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.content.findMany("gifts", { where: { status: "published" }, orderBy: { field: "createdAt", direction: "asc" }, limit: 100, cursor });
      gifts.push(...page.items.map(publicGift));
      cursor = page.nextCursor;
    } while (cursor);
    return { gifts };
  }

  async create(input: unknown, viewer: Viewer): Promise<CreatedGift> {
    if (!viewer.visitor) throw failure(401, "Your visitor identity is needed for this action.");
    let command: typeof CreateGiftSchema.Type;
    try { command = Schema.decodeUnknownSync(CreateGiftSchema)(input); }
    catch { throw failure(400, "Check the gift, name, and message and try again."); }
    const data = giftData(command, viewer.visitor.name);
    const id = `gift-${await digest(`${viewer.visitor.id}:${command.requestId}`)}`;
    const fingerprint = await digest(JSON.stringify(data));
    const retry = async (): Promise<CreatedGift | null> => {
      const { rows } = await sql<Receipt>`SELECT * FROM house_gift_receipts WHERE id = ${id}`.execute(this.db);
      if (!rows[0]) return null;
      if (rows[0].fingerprint !== fingerprint) throw failure(409, "This request was already used for a different gift.");
      const item = await this.content.findById("gifts", id);
      return { ...await this.snapshot(), createdGiftId: item?.status === "published" ? id : null };
    };
    const previous = await retry();
    if (previous) return previous;
    if (!viewer.owner && !await takeQuota(this.db, `house:gifts:${viewer.visitor.id}`, 10)) {
      throw failure(429, "A few gifts at a time is plenty. Try again in a minute.");
    }
    try {
      await this.content.create({ id, type: "gifts", status: "published", authorId: viewer.visitor.id,
        data: { ...data, submission_hash: fingerprint } });
    } catch (error) {
      const saved = await retry();
      if (saved) return saved;
      throw error;
    }
    return { ...await this.snapshot(), createdGiftId: id };
  }

  async detail(id: string, viewer: Viewer): Promise<GiftDetail> {
    const item = await this.content.findById("gifts", id);
    if (!item || item.status !== "published") throw failure(404, "This gift is no longer here.");
    const owns = viewer.visitor?.id === item.authorId;
    return { ...publicGift(item),
      message: item.data.visibility === "public" || owns || viewer.owner ? String(item.data.message ?? "") || null : null,
      canEdit: owns || viewer.owner, canReclaim: owns, canRemove: viewer.owner,
    };
  }

  async update(id: string, input: unknown, viewer: Viewer): Promise<HouseSnapshot> {
    if (!viewer.visitor) throw failure(401, "Your visitor identity is needed for this action.");
    const detail = await this.detail(id, viewer);
    if (!detail.canEdit) throw failure(403, "Only its sender or Kaio can edit this gift.");
    let command: typeof UpdateGiftSchema.Type;
    try { command = Schema.decodeUnknownSync(UpdateGiftSchema)(input); }
    catch { throw failure(400, "Check the gift, name, and message and try again."); }
    await this.content.update("gifts", id, { data: giftData(command, viewer.visitor.name) });
    return this.snapshot();
  }

  async remove(id: string, viewer: Viewer): Promise<HouseSnapshot> {
    if (!viewer.visitor) throw failure(401, "Your visitor identity is needed for this action.");
    const item = await this.content.findByIdIncludingTrashed("gifts", id);
    if (!item) throw failure(404, "This gift is no longer here.");
    if (!viewer.owner && item.authorId !== viewer.visitor.id) throw failure(403, "Only its sender or Kaio can remove this gift.");
    await this.content.delete("gifts", id);
    return this.snapshot();
  }
}

function giftData(command: typeof UpdateGiftSchema.Type, name: string) {
  if (!findEmoji(command.emojiId)) throw failure(400, "Choose one of the suggested emoji.");
  return { emoji_id: command.emojiId, author_name: command.displayName?.trim() || name,
    message: command.message?.trim() || null, visibility: command.message?.trim() ? command.visibility : "public" };
}

function publicGift(item: ContentItem): Gift {
  return {
    id: item.id, emojiId: String(item.data.emoji_id), authorName: String(item.data.author_name), createdAt: item.createdAt,
    visibility: item.data.visibility === "private" ? "private" : "public",
    message: item.data.visibility === "public" && typeof item.data.message === "string" ? item.data.message : null,
  };
}
