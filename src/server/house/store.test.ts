import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { ManagedRuntime } from "effect";
import type { CreateGift, Viewer } from "../../lib/house/types";
import { HouseService, result } from "./service";
import { HouseStore, type HousePhysics, type HouseSql } from "./store";

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
  const physics: HousePhysics = {
    initial: () => ({ size: { width: 600, height: 700 }, poses: [{ id: "octopus", x: 100, y: 100, angle: 0 }] }),
    settle: (gifts, poses, changed) => ({
      size: { width: 600, height: 700 },
      poses: [changed ?? poses[0], ...gifts.map((item, index) => ({ id: item.id, x: 200, y: 50 + index, angle: 0 }))],
    }),
    hasEmoji: (id) => id === "popcorn",
  };
  const store = new HouseStore(sql, physics);
  store.initialize();
  const runtime = ManagedRuntime.make(HouseService.layer(store));
  dispose.push(async () => { await runtime.dispose(); db.close(); });
  return { db, sql, physics, store, run: <A>(action: (service: HouseService["Service"]) => import("effect").Effect.Effect<A, import("./errors").HouseError>) => runtime.runPromise(result(HouseService.use(action))) };
}

describe("shared house authorization and persistence", () => {
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
    expect(store.snapshot().poses[0].id).toBe("octopus");
  });

  test("simultaneous releases accept one revision and return a rebase snapshot to the loser", async () => {
    const { run, store } = fixture();
    const results = await Promise.all([
      run((house) => house.place({ baseRevision: 0, pose: { id: "octopus", x: 300, y: 300, angle: 1 } }, sender)),
      run((house) => house.place({ baseRevision: 0, pose: { id: "octopus", x: 400, y: 400, angle: 2 } }, other)),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({ ok: false, status: 409, snapshot: { revision: 1 } });
    expect(store.snapshot().revision).toBe(1);
  });

  test("validation rejects oversized messages, arbitrary emoji, and non-finite positions", async () => {
    const { run } = fixture();
    expect(await run((house) => house.create({ ...gift, message: "x".repeat(2_001) }, sender))).toMatchObject({ ok: false, status: 400 });
    expect(await run((house) => house.create({ ...gift, emojiId: "made-up" }, sender))).toMatchObject({ ok: false, status: 400 });
    expect(await run((house) => house.place({ baseRevision: 0, pose: { id: "octopus", x: NaN, y: 50, angle: 0 } }, sender))).toMatchObject({ ok: false, status: 400 });
    expect(await run((house) => house.place({ baseRevision: 0, pose: { id: "octopus", x: 900, y: 50, angle: 0 } }, sender))).toMatchObject({ ok: false, status: 400 });
  });

  test("settling failure rolls back gift, receipt, and revision together", async () => {
    const { run, physics, store, db } = fixture();
    physics.settle = () => { throw new Error("simulation failed"); };
    expect(await run((house) => house.create(gift, sender))).toMatchObject({ ok: false, status: 500 });
    expect(store.snapshot().gifts).toHaveLength(0);
    expect(store.snapshot().revision).toBe(0);
    expect(db.query("SELECT * FROM gift_receipts").all()).toHaveLength(0);
  });

  test("saved gifts and layout survive new repository instances", async () => {
    const { run, sql, physics, store } = fixture();
    await run((house) => house.create(gift, sender));
    const restarted = new HouseStore(sql, physics);
    restarted.initialize();
    expect(restarted.snapshot()).toEqual(store.snapshot());
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
