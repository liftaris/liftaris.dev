import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { ManagedRuntime } from "effect";
import type { CreateGift, Viewer } from "../../lib/house/types";
import { HouseService, result } from "./service";
import { HouseStore, type HouseSql } from "./store";

const sender: Viewer = { visitor: { id: "one", name: "Capybara" }, owner: false };
const other: Viewer = { visitor: { id: "two", name: "Capybara" }, owner: false };
const owner: Viewer = { visitor: null, owner: true };
const stranger: Viewer = { visitor: null, owner: false };
const gift: CreateGift = { requestId: "attempt-1", emojiId: "popcorn", visibility: "private", message: "For your eyes only" };
const dispose: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of dispose.splice(0)) await cleanup(); });

function fixture() {
  const db = new Database(":memory:");
  const sql: HouseSql = {
    query: <T extends Record<string, string | number | null>>(query: string, ...values: (string | number | null)[]) => db.query(query).all(...values) as T[],
    transaction: (run) => db.transaction(run)(),
  };
  const hasEmoji = (id: string) => id === "popcorn";
  const store = new HouseStore(sql, hasEmoji);
  store.initialize();
  const runtime = ManagedRuntime.make(HouseService.layer(store));
  dispose.push(async () => { await runtime.dispose(); db.close(); });
  return { db, sql, hasEmoji, store, run: <A>(action: (service: HouseService["Service"]) => import("effect").Effect.Effect<A, import("./errors").HouseError>) => runtime.runPromise(result(HouseService.use(action))) };
}

describe("shared house authorization and persistence", () => {
  test("creation identifies this request's gift even after other visitors add gifts", async () => {
    const { run, store } = fixture();
    const first = await run((house) => house.create(gift, sender));
    const id = store.snapshot().gifts[0].id;
    expect(first).toMatchObject({ ok: true, value: { createdGiftId: id } });
    await run((house) => house.create(gift, other));
    expect(await run((house) => house.create(gift, sender))).toMatchObject({ ok: true, value: { createdGiftId: id } });
    await run((house) => house.remove(id, sender));
    expect(await run((house) => house.create(gift, sender))).toMatchObject({ ok: true, value: { createdGiftId: null } });
    expect(store.snapshot().gifts).toHaveLength(1);
  });

  test("private text is absent from snapshots and strangers' details; names confer no ownership", async () => {
    const { run, store } = fixture();
    const created = await run((house) => house.create(gift, sender));
    expect(created.ok).toBe(true);
    const snapshot = store.snapshot();
    const id = snapshot.gifts[0].id;
    expect(JSON.stringify(snapshot)).not.toContain(gift.message!);
    expect(JSON.stringify(snapshot)).not.toContain("creator_id");
    expect(store.detail(id, stranger).message).toBeNull();
    expect(store.detail(id, other).message).toBeNull();
    expect(store.detail(id, other).canReclaim).toBe(false);
    expect(store.detail(id, sender).message).toBe(gift.message!);
    expect(store.detail(id, owner).message).toBe(gift.message!);
    const denied = await run((house) => house.remove(id, other));
    expect(denied).toMatchObject({ ok: false, status: 403 });
    expect(store.snapshot().gifts).toHaveLength(1);
  });

  test("public messages remain public and chosen names are saved per gift", async () => {
    const { run, store } = fixture();
    await run((house) => house.create({ ...gift, visibility: "public", displayName: "  A friend  " }, sender));
    const saved = store.snapshot().gifts[0];
    expect(saved.authorName).toBe("A friend");
    expect(saved.message).toBe(gift.message!);
    expect(store.detail(saved.id, stranger).message).toBe(gift.message!);
  });

  test("retries do not duplicate or resurrect gifts and receipts do not retain deleted text", async () => {
    const { run, store, db } = fixture();
    await run((house) => house.create(gift, sender));
    await run((house) => house.create(gift, sender));
    expect(store.snapshot().revision).toBe(1);
    const id = store.snapshot().gifts[0].id;
    await run((house) => house.remove(id, sender));
    await run((house) => house.remove(id, sender));
    await run((house) => house.create(gift, sender));
    expect(store.snapshot().gifts).toHaveLength(0);
    expect(store.snapshot().revision).toBe(2);
    expect(JSON.stringify(db.query("SELECT * FROM gift_receipts").all())).not.toContain(gift.message!);
    expect(await run((house) => house.detail(id, sender))).toMatchObject({ ok: false, status: 404 });
    expect(await run((house) => house.create({ ...gift, message: "different" }, sender))).toMatchObject({ ok: false, status: 409 });
  });

  test("idempotency keys belong to their visitor", async () => {
    const { run, store } = fixture();
    await Promise.all([run((house) => house.create(gift, sender)), run((house) => house.create(gift, other))]);
    expect(store.snapshot().gifts).toHaveLength(2);
  });

  test("owner may remove gifts; built-in objects and unauthenticated writes are protected", async () => {
    const { run, store } = fixture();
    expect(await run((house) => house.create(gift, stranger))).toMatchObject({ ok: false, status: 401 });
    await run((house) => house.create(gift, sender));
    expect(await run((house) => house.remove("octopus", owner))).toMatchObject({ ok: false, status: 404 });
    await run((house) => house.remove(store.snapshot().gifts[0].id, owner));
    expect(store.snapshot().gifts).toHaveLength(0);

  });

  test("validation rejects oversized messages and arbitrary emoji", async () => {
    const { run } = fixture();
    expect(await run((house) => house.create({ ...gift, message: "x".repeat(2_001) }, sender))).toMatchObject({ ok: false, status: 400 });
    expect(await run((house) => house.create({ ...gift, emojiId: "made-up" }, sender))).toMatchObject({ ok: false, status: 400 });

  });

  test("storage failure rolls back gift, receipt, quota and revision together", async () => {
    const { run, store, db } = fixture();
    db.exec("CREATE TRIGGER fail_save BEFORE UPDATE ON house_state BEGIN SELECT RAISE(ABORT, 'storage failed'); END");
    expect(await run((house) => house.create(gift, sender))).toMatchObject({ ok: false, status: 500 });
    expect(store.snapshot().gifts).toHaveLength(0);
    expect(store.snapshot().revision).toBe(0);
    expect(db.query("SELECT * FROM gift_receipts").all()).toHaveLength(0);
    expect(db.query("SELECT * FROM house_limits").all()).toHaveLength(0);
  });

  test("saved gifts survive new repository instances", async () => {
    const { run, sql, hasEmoji, store } = fixture();
    await run((house) => house.create(gift, sender));
    const restarted = new HouseStore(sql, hasEmoji);
    restarted.initialize();
    expect(restarted.snapshot()).toEqual(store.snapshot());
  });

  test("v1 layout migration preserves gift identities, receipts, reclaim rights, quotas and revision", async () => {
    const { run, store, sql, db, hasEmoji } = fixture();
    await run((house) => house.create(gift, sender));
    const kept = store.snapshot().gifts[0].id;
    const removedGift = { ...gift, requestId: "removed" };
    await run((house) => house.create(removedGift, other));
    const removed = store.snapshot().gifts.find((item) => item.id !== kept)!.id;
    await run((house) => house.remove(removed, other));
    store.allowSuggestion("before-migration", 1_000);
    // Reconstitute the previous schema: these other tables are unchanged in v2.
    db.exec(`ALTER TABLE house_state ADD COLUMN poses TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE house_state ADD COLUMN size TEXT NOT NULL DEFAULT '{"width":600,"height":700}';
      DELETE FROM house_migrations WHERE version = 2;`);
    const tables = ["gifts", "gift_receipts", "removed_gifts", "house_limits"];
    const before = tables.map((table) => db.query(`SELECT * FROM ${table}`).all());
    const migrated = new HouseStore(sql, hasEmoji);
    migrated.initialize();
    migrated.initialize();
    expect(tables.map((table) => db.query(`SELECT * FROM ${table}`).all())).toEqual(before);
    expect(db.query("PRAGMA table_info(house_state)").all().map((row) => (row as { name: string }).name)).toEqual(["id", "revision"]);
    expect(migrated.snapshot()).toEqual(store.snapshot());
    expect(migrated.snapshot().revision).toBe(3);
    expect(migrated.detail(kept, sender)).toMatchObject({ canReclaim: true, message: gift.message });
    expect(migrated.detail(kept, other)).toMatchObject({ canReclaim: false, message: null });
    expect(await run((house) => house.create(gift, sender))).toMatchObject({ ok: true, value: { revision: 3 } });
    expect(await run((house) => house.create(removedGift, other))).toMatchObject({ ok: true, value: { revision: 3 } });
    expect(await run((house) => house.remove(removed, other))).toMatchObject({ ok: true, value: { revision: 3 } });
    expect(await run((house) => house.remove(kept, sender))).toMatchObject({ ok: true, value: { revision: 4, gifts: [] } });
  });

  test("gift quotas survive retries and restarts, reset after a minute, and exempt the owner", () => {
    const { store, sql, hasEmoji } = fixture();
    for (let i = 0; i < 10; i++) store.create(sender, { ...gift, requestId: `gift-${i}` }, "2026-09-24", 1_000, `hash-${i}`);
    const restarted = new HouseStore(sql, hasEmoji);
    restarted.initialize();
    expect(() => restarted.create(sender, { ...gift, requestId: "over-limit" }, "2026-09-24", 1_001, "hash-new")).toThrow("Give the house a moment");
    expect(restarted.create(sender, { ...gift, requestId: "gift-0" }, "2026-09-24", 1_001, "hash-0").revision).toBe(10);
    expect(restarted.create(owner, gift, "2026-09-24", 1_001, "owner").revision).toBe(11);
    expect(restarted.create(sender, { ...gift, requestId: "next-minute" }, "2026-09-24", 61_001, "hash-next").revision).toBe(12);
  });

  test("suggestion quotas are durable, reset after the minute, and do not cap gifts", () => {
    const { store } = fixture();
    for (let i = 0; i < 120; i++) expect(store.allowSuggestion("hashed-ip", 1_000)).toBe(true);
    expect(store.allowSuggestion("hashed-ip", 1_001)).toBe(false);
    expect(store.allowSuggestion("second-ip", 1_001)).toBe(true);
    expect(store.allowSuggestion("hashed-ip", 61_001)).toBe(true);
    expect(store.snapshot().gifts).toHaveLength(0);
  });
});
