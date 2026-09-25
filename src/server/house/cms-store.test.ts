import { afterEach, expect, test } from "bun:test";
import { ContentRepository, SchemaRegistry } from "emdash";
import { cmsTestDb } from "./cms-test-db";
import { CmsHouseStore } from "./cms-store";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanups.splice(0)) await close(); });

async function fixture() {
  const { db, sender, other, owner } = await cmsTestDb();
  cleanups.push(() => db.destroy());
  const store = new CmsHouseStore(db);
  await store.initialize();
  return { db, store,
    sender: { visitor: { id: sender.id, name: sender.name! }, owner: false },
    other: { visitor: { id: other.id, name: other.name! }, owner: false },
    owner: { visitor: { id: owner.id, name: owner.name! }, owner: true },
  };
}

const gift = { requestId: "one", emojiId: "popcorn", message: "Hello", visibility: "public" as const };

test("gifts are CMS records owned by the visitor's CMS account", async () => {
  const { db, store, sender } = await fixture();
  const result = await store.create(gift, sender);
  expect(result.createdGiftId).toBeString();
  const record = await new ContentRepository(db).findById("gifts", result.createdGiftId!);
  expect(record?.authorId).toBe(sender.visitor.id);
  expect(record?.data.message).toBe("Hello");
  expect(result.gifts).toHaveLength(1);
  const collection = await new SchemaRegistry(db).getCollection("gifts");
  expect(collection?.supports).not.toContain("search");
  expect(collection?.routable).toBe(false);
});

test("private messages are readable only by their sender and the owner", async () => {
  const { store, sender, other, owner } = await fixture();
  const created = await store.create({ ...gift, visibility: "private", message: "Private note" }, sender);
  const id = created.createdGiftId!;
  expect(JSON.stringify(created)).not.toContain("Private note");
  expect(JSON.stringify(created)).not.toContain(sender.visitor.id);
  expect(await store.detail(id, sender)).toMatchObject({ message: "Private note", canEdit: true, canReclaim: true });
  expect(await store.detail(id, owner)).toMatchObject({ message: "Private note", canRemove: true });
  expect(await store.detail(id, other)).toMatchObject({ message: null, canEdit: false, canReclaim: false });
  expect(await store.detail(id, { visitor: null, owner: false })).toMatchObject({ message: null, canEdit: false });
});

test("visitors can edit only their own gifts and cannot change ownership", async () => {
  const { db, store, sender, other } = await fixture();
  const id = (await store.create(gift, sender)).createdGiftId!;
  await expect(store.update(id, { ...gift, message: "stolen" }, other)).rejects.toMatchObject({ status: 403 });
  await expect(store.update(id, gift, { visitor: null, owner: false })).rejects.toMatchObject({ status: 401 });
  const changed = await store.update(id, { ...gift, message: "Secret edit", visibility: "private", authorId: other.visitor.id, status: "draft", collection: "posts" }, sender);
  expect(changed.gifts[0].message).toBeNull();
  expect(await store.detail(id, sender)).toMatchObject({ message: "Secret edit", canEdit: true });
  const record = await new ContentRepository(db).findById("gifts", id);
  expect(record?.authorId).toBe(sender.visitor.id);
  expect(record?.status).toBe("published");
  await expect(store.update(id, { ...gift, emojiId: "bogus" }, sender)).rejects.toMatchObject({ status: 400 });
  await expect(store.update(id, { ...gift, message: "x".repeat(2001) }, sender)).rejects.toMatchObject({ status: 400 });
});

test("withdrawal is sender-only, owner moderation works, and CMS changes are authoritative", async () => {
  const { db, store, sender, other, owner } = await fixture();
  const id = (await store.create(gift, sender)).createdGiftId!;
  await expect(store.remove(id, other)).rejects.toMatchObject({ status: 403 });
  expect((await store.remove(id, sender)).gifts).toEqual([]);
  await expect(store.detail(id, sender)).rejects.toMatchObject({ status: 404 });
  expect((await store.remove(id, sender)).gifts).toEqual([]);
  const second = (await store.create({ ...gift, requestId: "two" }, other)).createdGiftId!;
  const repository = new ContentRepository(db);
  await repository.update("gifts", second, { data: { message: "Edited in CMS" } });
  expect((await store.snapshot()).gifts[0].message).toBe("Edited in CMS");
  expect((await store.remove(second, owner)).gifts).toEqual([]);
});

test("concurrent retries deduplicate and cannot resurrect a permanently deleted gift", async () => {
  const { db, store, sender, other } = await fixture();
  const results = await Promise.all([store.create(gift, sender), store.create(gift, sender)]);
  expect(results[0].createdGiftId).toBe(results[1].createdGiftId);
  expect((await store.snapshot()).gifts).toHaveLength(1);
  const id = results[0].createdGiftId!;
  await expect(store.create({ ...gift, message: "different" }, sender)).rejects.toMatchObject({ status: 409 });
  await store.create(gift, other);
  await store.remove(id, sender);
  expect((await store.create(gift, sender)).createdGiftId).toBeNull();
  await new ContentRepository(db).permanentDelete("gifts", id);
  const restarted = new CmsHouseStore(db);
  await restarted.initialize();
  expect((await restarted.create(gift, sender)).createdGiftId).toBeNull();
  expect((await restarted.snapshot()).gifts).toHaveLength(1);
});

test("new submissions are limited per CMS user but retries and owner moderation remain available", async () => {
  const { store, sender, owner } = await fixture();
  for (let i = 0; i < 10; i++) await store.create({ ...gift, requestId: `attempt-${i}` }, sender);
  await expect(store.create({ ...gift, requestId: "too-many" }, sender)).rejects.toMatchObject({ status: 429 });
  expect((await store.create({ ...gift, requestId: "attempt-0" }, sender)).createdGiftId).toBeString();
  expect((await store.create(gift, owner)).createdGiftId).toBeString();
});

test("concurrent first requests initialize one complete gift collection", async () => {
  const { db } = await cmsTestDb();
  cleanups.push(() => db.destroy());
  const stores = Array.from({ length: 4 }, () => new CmsHouseStore(db));
  await Promise.all(stores.map((store) => store.initialize()));
  expect(await stores[0].snapshot()).toEqual({ gifts: [] });
  expect((await new SchemaRegistry(db).getCollectionWithFields("gifts"))?.fields.map((field) => field.slug)).toContain("submission_hash");
});
