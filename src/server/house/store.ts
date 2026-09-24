import { OBJECTS, type Pose, type Size } from "../../components/clump/model";
import type { CreateGift, Gift, GiftDetail, HouseSnapshot, PlaceObject, Viewer } from "../../lib/house/types";
import { failure } from "./errors";

export type SqlValue = string | number | null;
export interface HouseSql {
  query<T extends Record<string, SqlValue>>(sql: string, ...values: SqlValue[]): T[];
  transaction<T>(run: () => T): T;
}
export interface HousePhysics {
  initial(gifts: Gift[]): { poses: Pose[]; size: Size };
  settle(gifts: Gift[], poses: Pose[], changedPose?: Pose): { poses: Pose[]; size: Size };
  hasEmoji(id: string): boolean;
}
type GiftRow = {
  id: string; emoji_id: string; creator_id: string; author_name: string;
  created_at: string; visibility: "public" | "private"; message: string | null;
};
type StateRow = { revision: number; poses: string; size: string };

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
  constructor(private readonly sql: HouseSql, private readonly physics: HousePhysics) {}

  initialize(): void {
    this.sql.transaction(() => {
      this.sql.query(`CREATE TABLE IF NOT EXISTS house_migrations (version INTEGER PRIMARY KEY)`);
      this.sql.query(`CREATE TABLE IF NOT EXISTS house_state (
        id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, poses TEXT NOT NULL, size TEXT NOT NULL
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
      if (!this.sql.query<StateRow>("SELECT revision, poses, size FROM house_state WHERE id = 1").length) {
        const initial = this.physics.initial([]);
        this.sql.query("INSERT INTO house_state VALUES (1, 0, ?, ?)", JSON.stringify(initial.poses), JSON.stringify(initial.size));
      }
      this.sql.query("INSERT OR IGNORE INTO house_migrations VALUES (1)");
    });
  }

  snapshot(): HouseSnapshot {
    const state = this.sql.query<StateRow>("SELECT revision, poses, size FROM house_state WHERE id = 1")[0];
    return {
      revision: state.revision, gifts: this.gifts(),
      poses: JSON.parse(state.poses) as Pose[], size: JSON.parse(state.size) as Size,
    };
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

  create(viewer: Viewer, input: CreateGift, createdAt: string, now: number, payloadHash: string): HouseSnapshot {
    const creator = actorId(viewer);
    if (!this.physics.hasEmoji(input.emojiId)) throw failure(400, "Choose one of the suggested emoji.");
    const message = input.message?.trim() || null;
    const name = input.displayName?.trim() || viewer.visitor?.name || "Kaio";
    const visibility = message ? input.visibility : "public";
    return this.sql.transaction(() => {
      const receipt = this.sql.query<{ gift_id: string; payload: string }>(
        "SELECT gift_id, payload FROM gift_receipts WHERE creator_id = ? AND request_id = ?", creator, input.requestId,
      )[0];
      if (receipt) {
        if (receipt.payload !== payloadHash) throw failure(409, "This placement was already used for a different gift.");
        // Receipts outlive removals: retrying a lost response never recreates a withdrawn gift.
        return this.snapshot();
      }
      this.limit(viewer, "gift", now, 10);
      const previous = this.snapshot();
      const id = `gift-${crypto.randomUUID()}`;
      this.sql.query("INSERT INTO gifts VALUES (?, ?, ?, ?, ?, ?, ?)", id, input.emojiId, creator, name, createdAt, visibility, message);
      this.sql.query("INSERT INTO gift_receipts VALUES (?, ?, ?, ?)", creator, input.requestId, id, payloadHash);
      return this.save(previous.revision + 1, this.physics.settle(this.gifts(), previous.poses));
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
      const previous = this.snapshot();
      this.sql.query("INSERT OR IGNORE INTO removed_gifts VALUES (?, ?)", id, row.creator_id);
      this.sql.query("DELETE FROM gifts WHERE id = ?", id);
      return this.save(previous.revision + 1, this.physics.settle(this.gifts(), previous.poses.filter((pose) => pose.id !== id)));
    });
  }

  place(viewer: Viewer, input: PlaceObject, now: number): HouseSnapshot {
    actorId(viewer);
    return this.sql.transaction(() => {
      const previous = this.snapshot();
      if (previous.revision !== input.baseRevision) throw failure(409, "The house changed while you were moving that object.", previous);
      if (!OBJECTS.some((object) => object.id === input.pose.id) && !previous.gifts.some((gift) => gift.id === input.pose.id)) {
        throw failure(404, "That object is no longer here.");
      }
      if (input.pose.x > previous.size.width || input.pose.y > previous.size.height) throw failure(400, "Keep the object inside the house.");
      this.limit(viewer, "place", now, 120);
      return this.save(previous.revision + 1, this.physics.settle(previous.gifts, previous.poses, input.pose));
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

  private save(revision: number, layout: { poses: Pose[]; size: Size }): HouseSnapshot {
    this.sql.query("UPDATE house_state SET revision = ?, poses = ?, size = ? WHERE id = 1", revision, JSON.stringify(layout.poses), JSON.stringify(layout.size));
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
