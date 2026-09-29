import { ContentRepository, MediaRepository, invalidateCollectionCache, ulid, type ContentItem, type Database } from "emdash";
import { sql, type Kysely } from "kysely";
import { DateTime, Schema } from "effect";
import type { CreatedGift, Gift, GiftDetail, HouseSnapshot, Viewer } from "../../lib/house/types";
import { findEmoji } from "../../lib/house/emoji";
import { CreateGiftSchema, UpdateGiftSchema } from "./schemas";
import { failure } from "./errors";
import { digest, initializeGiftCollection, initializeThingsCollection } from "./cms-schema";
import { takeQuota } from "./rate-limit";

type Receipt = { id: string; author_id: string; fingerprint: string };

export interface DoodleStorage {
  put?: (
    key: string,
    body: Uint8Array,
    opts?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>;
}

export class CmsHouseStore {
  private readonly content: ContentRepository;
  constructor(private readonly db: Kysely<Database>, private readonly storage?: DoodleStorage) {
    this.content = new ContentRepository(db);
  }

  async initialize(): Promise<void> {
    await initializeGiftCollection(this.db);
    await initializeThingsCollection(this.db);
  }

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
    let doodleUrl: string | null = null;
    if (command.doodle && typeof command.doodle === "string" && command.doodle.trim()) {
      doodleUrl = await saveDoodleMedia(this.db, viewer.visitor.id, command.doodle.trim(), this.storage);
    }
    const data = giftData(command, viewer.visitor.name, doodleUrl);
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
    const gift = publicGift(item);
    const canRead = gift.visibility === "public" || owns || viewer.owner;
    const doodle = extractDoodleUrl(item.data.doodle);
    return { ...gift, version: item.version,
      authorName: canRead ? String(item.data.author_name) : null,
      message: canRead ? String(item.data.message ?? "") || null : null,
      doodle: canRead ? doodle : null,
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
    let doodleUrl: string | null = null;
    if (command.doodle && typeof command.doodle === "string" && command.doodle.trim()) {
      doodleUrl = await saveDoodleMedia(this.db, viewer.visitor.id, command.doodle.trim(), this.storage);
    }
    const data = giftData(command, viewer.visitor.name, doodleUrl);
    // EmDash 0.40.1's field update still has no atomic expected-version predicate.
    // Native draft-pointer CAS + publish is possible, but is two commits with
    // failure reconciliation, not a drop-in replacement for immediate edits.
    // Preserve this fence until that lifecycle migration is independently tested.
    const result = await sql`UPDATE ec_gifts
      SET emoji_id = ${data.emoji_id}, author_name = ${data.author_name},
        message = ${data.message}, visibility = ${data.visibility},
        doodle = ${data.doodle},
        updated_at = ${DateTime.formatIso(DateTime.nowUnsafe())}, version = version + 1
      WHERE id = ${id} AND version = ${command.version}
        AND status = 'published' AND deleted_at IS NULL
        ${viewer.owner ? sql`` : sql`AND author_id = ${viewer.visitor.id}`}
    `.execute(this.db);
    if (!result.numAffectedRows) throw failure(409, "This gift changed. Reload it before saving again.");
    invalidateCollectionCache("gifts");
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

  async uploadDoodle(doodleDataUrl: string, viewer: Viewer): Promise<string> {
    if (!viewer.visitor) throw failure(401, "Your visitor identity is needed for this action.");
    return await saveDoodleMedia(this.db, viewer.visitor.id, doodleDataUrl, this.storage);
  }
}

function extractDoodleUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const url = (obj.url || obj.src || obj.previewUrl) as string | undefined;
    if (url) return url;
    if (obj.id) {
      const key = (obj.meta as Record<string, unknown> | undefined)?.storageKey || obj.id;
      return `/_emdash/api/media/file/${key}`;
    }
  }
  return null;
}

async function saveDoodleMedia(
  db: Kysely<Database>,
  authorId: string,
  doodleDataUrl: string,
  storage?: DoodleStorage
): Promise<string> {
  const match = doodleDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return doodleDataUrl;
  const mimeType = match[1];
  const base64Data = match[2];
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const mediaRepo = new MediaRepository(db);
  const id = ulid();
  const ext = mimeType.includes("png") ? "png" : "webp";
  const filename = `gift-doodle-${id}.${ext}`;
  const storageKey = `gifts/${filename}`;
  if (storage?.put) {
    try {
      await storage.put(storageKey, bytes, { httpMetadata: { contentType: mimeType } });
    } catch {
      // Continue even if storage put fails
    }
  }
  try {
    await mediaRepo.create({
      filename,
      mimeType,
      size: bytes.byteLength,
      storageKey,
      status: "ready",
      authorId,
    });
  } catch {
    // If media repo fails, fallback
  }
  return `/_emdash/api/media/file/${storageKey}`;
}

function giftData(command: Omit<typeof UpdateGiftSchema.Type, "version">, name: string, doodle?: string | null) {
  if (!findEmoji(command.emojiId)) throw failure(400, "Choose one of the suggested emoji.");
  return {
    emoji_id: command.emojiId,
    author_name: command.displayName?.trim() || name,
    message: command.message?.trim() || null,
    visibility: command.message?.trim() ? command.visibility : "public",
    doodle: doodle ?? (command.doodle?.trim() || null),
  };
}

function publicGift(item: ContentItem): Gift {
  const visibility = item.data.message && item.data.visibility === "private" ? "private" : "public";
  const doodle = extractDoodleUrl(item.data.doodle);
  return {
    id: item.id, emojiId: String(item.data.emoji_id), authorName: visibility === "public" ? String(item.data.author_name) : null, createdAt: item.createdAt,
    visibility,
    message: visibility === "public" && typeof item.data.message === "string" ? item.data.message : null,
    doodle: visibility === "public" ? doodle : null,
  };
}
