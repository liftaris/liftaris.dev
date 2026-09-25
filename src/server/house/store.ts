import type { CreateGift, CreatedGift, Gift, GiftDetail, HouseSnapshot, Viewer } from "../../lib/house/types";
import { failure } from "./errors";

export type SqlValue = string | number | null;
export interface HouseSql {
  query<T extends Record<string, SqlValue>>(sql: string, ...values: SqlValue[]): T[];
  transaction<T>(run: () => T): T;
}

type GiftRow = {
  id: string; emoji_id: string; creator_id: string; author_name: string;
  created_at: string; visibility: "public" | "private"; message: string | null;
};
type StateRow = { revision: number };

function publicGift(row: GiftRow): Gift {
  return {
    id: row.id, emojiId: row.emoji_id, authorName: row.author_name,
    createdAt: row.created_at, visibility: row.visibility,
    message: row.visibility === "public" ? row.message : null,
  };
}

function actorId(viewer: Viewer): string {
  if (viewer.visitor) return viewer.visitor.id;
  if (viewer.owner) return "house-owner";
  throw failure(401, "Your visitor identity is needed for this action.");
}

/** All command checks and writes run in one synchronous SQLite transaction. */
export class HouseStore {
  constructor(private readonly sql: HouseSql, private readonly hasEmoji: (id: string) => boolean) {}

  initialize(): void {
    this.sql.transaction(() => {
      this.sql.query(`CREATE TABLE IF NOT EXISTS house_migrations (version INTEGER PRIMARY KEY)`);
      this.sql.query(`CREATE TABLE IF NOT EXISTS house_state (
        id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL
      )`);
      this.sql.query(`CREATE TABLE IF NOT EXISTS gifts (
        id TEXT PRIMARY KEY, emoji_id TEXT NOT NULL, creator_id TEXT NOT NULL,
        author_name TEXT NOT NULL, created_at TEXT NOT NULL,
        visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')), message TEXT
      )`);
      this.sql.query(`CREATE TABLE IF NOT EXISTS gift_receipts (
        creator_id TEXT NOT NULL, request_id TEXT NOT NULL, gift_id TEXT NOT NULL,
        payload TEXT NOT NULL, PRIMARY KEY (creator_id, request_id)
      )`);
      this.sql.query(`CREATE TABLE IF NOT EXISTS removed_gifts (id TEXT PRIMARY KEY, creator_id TEXT NOT NULL)`);
      this.sql.query(`CREATE TABLE IF NOT EXISTS house_limits (
        key TEXT PRIMARY KEY, started INTEGER NOT NULL, count INTEGER NOT NULL
      )`);
      if (!this.sql.query("SELECT version FROM house_migrations WHERE version = 2").length) {
        // Keep the existing revision, gifts, receipts and reclaim tombstones. Only
        // the obsolete authoritative layout is discarded, once, in this transaction.
        this.sql.query(`CREATE TABLE house_state_v2 (
          id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL
        )`);
        this.sql.query("INSERT INTO house_state_v2 SELECT id, revision FROM house_state");
        this.sql.query("DROP TABLE house_state");
        this.sql.query("ALTER TABLE house_state_v2 RENAME TO house_state");
        this.sql.query("INSERT INTO house_migrations VALUES (2)");
      }
      this.sql.query("INSERT OR IGNORE INTO house_state VALUES (1, 0)");
      this.sql.query("INSERT OR IGNORE INTO house_migrations VALUES (1)");
    });
  }

  snapshot(): HouseSnapshot {
    const state = this.sql.query<StateRow>("SELECT revision FROM house_state WHERE id = 1")[0];
    return { revision: state.revision, gifts: this.gifts() };
  }

  detail(id: string, viewer: Viewer): GiftDetail {
    const row = this.sql.query<GiftRow>("SELECT * FROM gifts WHERE id = ?", id)[0];
    if (!row) throw failure(404, "This gift is no longer here.");
    const canReclaim = viewer.visitor?.id === row.creator_id;
    return {
      ...publicGift(row),
      message: row.visibility === "public" || canReclaim || viewer.owner ? row.message : null,
      canReclaim, canRemove: viewer.owner,
    };
  }

  create(viewer: Viewer, input: CreateGift, createdAt: string, now: number, payloadHash: string): CreatedGift {
    const creator = actorId(viewer);
    if (!this.hasEmoji(input.emojiId)) throw failure(400, "Choose one of the suggested emoji.");
    const message = input.message?.trim() || null;
    const name = input.displayName?.trim() || viewer.visitor?.name || "Kaio";
    const visibility = message ? input.visibility : "public";
    return this.sql.transaction(() => {
      const receipt = this.sql.query<{ gift_id: string; payload: string }>(
        "SELECT gift_id, payload FROM gift_receipts WHERE creator_id = ? AND request_id = ?", creator, input.requestId,
      )[0];
      if (receipt) {
        if (receipt.payload !== payloadHash) throw failure(409, "This request was already used for a different gift.");
        // Receipts outlive removals: retrying a lost response never recreates a withdrawn gift.
        const snapshot = this.snapshot();
        return { ...snapshot, createdGiftId: snapshot.gifts.some((gift) => gift.id === receipt.gift_id) ? receipt.gift_id : null };
      }
      this.limit(viewer, "gift", now, 10);
      const id = `gift-${crypto.randomUUID()}`;
      this.sql.query("INSERT INTO gifts VALUES (?, ?, ?, ?, ?, ?, ?)", id, input.emojiId, creator, name, createdAt, visibility, message);
      this.sql.query("INSERT INTO gift_receipts VALUES (?, ?, ?, ?)", creator, input.requestId, id, payloadHash);
      return { ...this.save(), createdGiftId: id };
    });
  }

  remove(viewer: Viewer, id: string): HouseSnapshot {
    actorId(viewer);
    return this.sql.transaction(() => {
      const row = this.sql.query<GiftRow>("SELECT * FROM gifts WHERE id = ?", id)[0];
      if (!row) {
        const removed = this.sql.query<{ creator_id: string }>("SELECT creator_id FROM removed_gifts WHERE id = ?", id)[0];
        if (removed && (viewer.owner || viewer.visitor?.id === removed.creator_id)) return this.snapshot();
        throw failure(404, "This gift is no longer here.");
      }
      if (!viewer.owner && viewer.visitor?.id !== row.creator_id) throw failure(403, "Only its sender or Kaio can remove this gift.");
      this.sql.query("INSERT OR IGNORE INTO removed_gifts VALUES (?, ?)", id, row.creator_id);
      this.sql.query("DELETE FROM gifts WHERE id = ?", id);
      return this.save();
    });
  }

  allowSuggestion(key: string, now: number): boolean {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key)) return false;
    return this.sql.transaction(() => {
      const limits = [{ key: `suggest:${key}`, maximum: 120 }, { key: "suggest:global", maximum: 600 }];
      const values = limits.map((limit) => ({
        ...limit,
        row: this.sql.query<{ started: number; count: number }>("SELECT started, count FROM house_limits WHERE key = ?", limit.key)[0],
      }));
      if (values.some(({ row, maximum }) => row && now - row.started < 60_000 && row.count >= maximum)) return false;
      this.sql.query("DELETE FROM house_limits WHERE started < ?", now - 60_000);
      for (const { key: limitKey, row } of values) {
        const active = row && now - row.started < 60_000;
        this.sql.query("INSERT OR REPLACE INTO house_limits VALUES (?, ?, ?)", limitKey, active ? row.started : now, active ? row.count + 1 : 1);
      }
      return true;
    });
  }

  private gifts(): Gift[] {
    return this.sql.query<GiftRow>("SELECT * FROM gifts ORDER BY created_at, id").map(publicGift);
  }

  private save(): HouseSnapshot {
    this.sql.query("UPDATE house_state SET revision = revision + 1 WHERE id = 1");
    return this.snapshot();
  }

  private limit(viewer: Viewer, action: string, now: number, maximum: number): void {
    if (viewer.owner) return;
    const key = `${action}:${actorId(viewer)}`;
    const current = this.sql.query<{ started: number; count: number }>("SELECT started, count FROM house_limits WHERE key = ?", key)[0];
    if (current && now - current.started < 60_000 && current.count >= maximum) throw failure(429, "Give the house a moment, then try again.");
    const active = current && now - current.started < 60_000;
    this.sql.query("INSERT OR REPLACE INTO house_limits VALUES (?, ?, ?)", key, active ? current.started : now, active ? current.count + 1 : 1);
  }
}
