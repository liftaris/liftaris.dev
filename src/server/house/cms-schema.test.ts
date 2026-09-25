import { afterEach, expect, spyOn, test } from "bun:test";
import { ContentRepository, OptionsRepository, SchemaRegistry, type Database } from "emdash";
import { sql, type Transaction } from "kysely";
import { initializeGiftCollection } from "./cms-schema";
import { CmsHouseStore } from "./cms-store";
import { cmsTestDb } from "./cms-test-db";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanups.splice(0)) await close(); });

async function fixture() {
  const context = await cmsTestDb();
  const { db } = context;
  // EmDash caches transaction support process-wide. Inject its D1 fallback at
  // this DB's transaction boundary, so test order cannot enable SQLite rollback.
  // Everything inside the callback still uses the real migrated database.
  const transaction = db.transaction.bind(db);
  const fallback = spyOn(db, "transaction").mockImplementation(() => {
    const builder = transaction();
    builder.execute = (callback) => callback(db as Transaction<Database>);
    return builder;
  });
  cleanups.push(async () => { fallback.mockRestore(); await db.destroy(); });
  return { ...context, schema: new SchemaRegistry(db), options: new OptionsRepository(db) };
}

const expectedFields = [
  { slug: "emoji_id", type: "string", required: true, searchable: false },
  { slug: "author_name", type: "string", required: true, searchable: false },
  { slug: "message", type: "text", required: false, searchable: false },
  { slug: "visibility", type: "select", required: true, searchable: false },
  { slug: "submission_hash", type: "string", required: false, searchable: false },
];

test("does not mark an incompatible registered gift schema ready", async () => {
  const { db, schema, options } = await fixture();
  await initializeGiftCollection(db);
  await options.delete("house:gift-schema");
  await schema.updateField("gifts", "message", { type: "string" });
  await expect(initializeGiftCollection(db)).rejects.toMatchObject({ code: "CREATE_FAILED" });
  expect(await options.get<number>("house:gift-schema")).toBeNull();
  expect((await schema.getField("gifts", "message"))?.type).toBe("string");
});

test.each([
  { name: "public search", change: sql`UPDATE _emdash_collections SET supports = '["search"]' WHERE slug = 'gifts'` },
  { name: "public routing", change: sql`UPDATE _emdash_collections SET routable = 1 WHERE slug = 'gifts'` },
  { name: "comments", change: sql`UPDATE _emdash_collections SET comments_enabled = 1 WHERE slug = 'gifts'` },
  { name: "searchable field", change: sql`UPDATE _emdash_fields SET searchable = 1 WHERE slug = 'message'` },
  { name: "optional required field", change: sql`UPDATE _emdash_fields SET required = 0 WHERE slug = 'emoji_id'` },
  { name: "incompatible storage metadata", change: sql`UPDATE _emdash_fields SET column_type = 'INTEGER' WHERE slug = 'message'` },
  { name: "incompatible visibility values", change: sql`UPDATE _emdash_fields SET validation = '{"options":["public"]}' WHERE slug = 'visibility'` },
  { name: "missing physical column", change: sql`ALTER TABLE ec_gifts DROP COLUMN message` },
])("rejects $name before writing readiness", async ({ change }) => {
  const context = await fixture();
  const { db, options } = context;
  await initializeGiftCollection(db);
  await options.delete("house:gift-schema");
  await change.execute(db);
  await expect(initializeGiftCollection(db)).rejects.toMatchObject({ code: "CREATE_FAILED" });
  expect(await options.get<number>("house:gift-schema")).toBeNull();
});

test.each([
  { name: "expanded capture", active: false, legacyReady: false },
  { name: "expanded capture with stale version 1", active: false, legacyReady: true },
  { name: "active capture", active: true, legacyReady: false },
  { name: "active capture with stale version 1", active: true, legacyReady: true },
])("recovers interrupted field metadata: $name", async ({ active, legacyReady }) => {
  const { db, schema, options, sender } = await fixture();
  // A new empty migrated DB starts expanded. Exercise the native seed cursor
  // path too, without activating or changing any production collection.
  if (active) await db.updateTable("_emdash_media_usage_activation").set({ state: "active" }).execute();
  await sql`CREATE TRIGGER interrupt_gift_fields BEFORE INSERT ON _emdash_fields
    BEGIN SELECT RAISE(ABORT, 'injected field metadata failure'); END`.execute(db);

  await expect(initializeGiftCollection(db)).rejects.toThrow("injected field metadata failure");
  const interrupted = await schema.getCollectionWithFields("gifts");
  expect(interrupted?.source).toBe("seed");
  expect(interrupted?.fields).toEqual([]);
  expect(await options.get<number>("house:gift-schema")).toBeNull();
  const columns = (await sql<{ name: string }>`PRAGMA table_info(ec_gifts)`.execute(db)).rows;
  for (const field of expectedFields) expect(columns.map((column) => column.name)).toContain(field.slug);
  await expect(initializeGiftCollection(db)).rejects.toThrow("injected field metadata failure");
  expect((await schema.getCollectionWithFields("gifts"))?.fields).toEqual([]);
  expect(await options.get<number>("house:gift-schema")).toBeNull();
  if (active) {
    const capture = await db.selectFrom("_emdash_media_usage_index_status").select(["capture_state", "cursor"])
      .where("scope_key", "=", "gifts").executeTakeFirstOrThrow();
    expect(capture.capture_state).toBe("ready");
    expect(capture.cursor).toStartWith("media-usage-seed:v1:sha256:");
  }

  // The old initializer could incorrectly persist 1 on its first retry.
  if (legacyReady) await options.set("house:gift-schema", 1);
  await sql`DROP TRIGGER interrupt_gift_fields`.execute(db);
  await initializeGiftCollection(db);
  const recovered = await schema.getCollectionWithFields("gifts");
  expect(recovered?.id).toBe(interrupted?.id);
  expect(recovered).toMatchObject({ supports: [], routable: false, commentsEnabled: false });
  expect(recovered?.fields).toMatchObject(expectedFields);
  expect(recovered?.fields).toHaveLength(expectedFields.length);
  expect(recovered?.fields.find((field) => field.slug === "visibility")?.validation).toEqual({ options: ["public", "private"] });
  expect(await options.get<number>("house:gift-schema")).toBe(2);
  if (active) {
    const capture = await db.selectFrom("_emdash_media_usage_index_status").select(["capture_state", "cursor"])
      .where("scope_key", "=", "gifts").executeTakeFirstOrThrow();
    expect(capture).toEqual({ capture_state: "active", cursor: null });
  }

  const store = new CmsHouseStore(db);
  const result = await store.create({ requestId: "recovered", emojiId: "popcorn", message: "Recovered gift", visibility: "public" }, { visitor: { ...sender, name: sender.name! }, owner: false });
  expect(result.gifts).toHaveLength(1);
  expect((await new ContentRepository(db).findById("gifts", result.createdGiftId!))?.data.message).toBe("Recovered gift");
  await initializeGiftCollection(db);
  expect(await schema.getCollectionWithFields("gifts")).toEqual(recovered);
});

test("resumes native capture finalization without replacing already-inserted fields", async () => {
  const { db, schema, options } = await fixture();
  await db.updateTable("_emdash_media_usage_activation").set({ state: "active" }).execute();
  await sql`CREATE TRIGGER interrupt_gift_capture BEFORE UPDATE OF capture_state ON _emdash_media_usage_index_status
    WHEN NEW.scope_key = 'gifts' AND NEW.capture_state = 'active'
    BEGIN SELECT RAISE(ABORT, 'injected capture finalization failure'); END`.execute(db);
  await expect(initializeGiftCollection(db)).rejects.toThrow("injected capture finalization failure");
  const before = await schema.getCollectionWithFields("gifts");
  expect(before?.fields).toHaveLength(expectedFields.length);
  expect(await options.get<number>("house:gift-schema")).toBeNull();
  await sql`DROP TRIGGER interrupt_gift_capture`.execute(db);
  await initializeGiftCollection(db);
  expect(await schema.getCollectionWithFields("gifts")).toEqual(before);
  expect(await options.get<number>("house:gift-schema")).toBe(2);
  const capture = await db.selectFrom("_emdash_media_usage_index_status").select(["capture_state", "cursor"])
    .where("scope_key", "=", "gifts").executeTakeFirstOrThrow();
  expect(capture).toEqual({ capture_state: "active", cursor: null });
});

test("retries a failed readiness write without changing admin customizations or existing data", async () => {
  const { db, schema, options, sender } = await fixture();
  await sql`CREATE TRIGGER interrupt_gift_readiness BEFORE INSERT ON options WHEN NEW.name = 'house:gift-schema'
    BEGIN SELECT RAISE(ABORT, 'injected readiness failure'); END`.execute(db);
  await expect(initializeGiftCollection(db)).rejects.toThrow("injected readiness failure");
  expect(await options.get<number>("house:gift-schema")).toBeNull();
  await schema.updateCollection("gifts", { label: "Visitor objects", icon: "gift", sortOrder: 7 });
  await schema.updateField("gifts", "message", { label: "Personal note", sortOrder: 12, widget: "textarea" });
  const before = await schema.getCollectionWithFields("gifts");
  const store = new CmsHouseStore(db);
  const gift = { requestId: "readiness", emojiId: "popcorn", message: "Preserved", visibility: "public" };
  const viewer = { visitor: { ...sender, name: sender.name! }, owner: false };
  const created = await store.create(gift, viewer);
  await sql`DROP TRIGGER interrupt_gift_readiness`.execute(db);
  await initializeGiftCollection(db);
  expect(await options.get<number>("house:gift-schema")).toBe(2);
  expect(await schema.getCollectionWithFields("gifts")).toEqual(before);
  expect(await store.create(gift, viewer)).toEqual(created);
  expect((await sql`SELECT * FROM house_gift_receipts`.execute(db)).rows).toHaveLength(1);
});

test("does not adopt missing metadata in an administrator-owned collection", async () => {
  const { db, schema, options } = await fixture();
  await initializeGiftCollection(db);
  await options.delete("house:gift-schema");
  await db.updateTable("_emdash_collections").set({ source: "manual" }).where("slug", "=", "gifts").execute();
  const collection = (await schema.getCollection("gifts"))!;
  await db.deleteFrom("_emdash_fields").where("collection_id", "=", collection.id).execute();
  await expect(initializeGiftCollection(db)).rejects.toMatchObject({ code: "COLLECTION_EXISTS" });
  expect((await schema.getCollectionWithFields("gifts"))?.fields).toEqual([]);
  expect(await options.get<number>("house:gift-schema")).toBeNull();
});
