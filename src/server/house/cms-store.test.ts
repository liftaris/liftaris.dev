import { afterEach, expect, test } from "bun:test";
import { ContentRepository } from "emdash";
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
const stranger = { visitor: null, owner: false };

test("private gifts keep public icons but reveal message and author only to sender/owner; empty gifts are public", async () => {
  const { store, sender, other, owner } = await fixture();
  const secret = { ...gift, visibility: "private", message: "Private note", displayName: "Private sender" };
  const created = await store.create(secret, sender);
  const id = created.createdGiftId!;
  const redacted = { id, emojiId: gift.emojiId, visibility: "private", message: null, authorName: null };
  expect(created.gifts[0]).toMatchObject(redacted);
  expect(await store.snapshot()).toEqual({ gifts: created.gifts });
  for (const viewer of [other, stranger]) {
    const detail = await store.detail(id, viewer);
    expect(detail).toMatchObject({ ...redacted, canEdit: false, canReclaim: false, canRemove: false });
    for (const hidden of [secret.message, secret.displayName, sender.visitor.id]) {
      expect(JSON.stringify({ created, detail })).not.toContain(hidden);
    }
  }
  expect(await store.detail(id, sender)).toMatchObject({ message: secret.message, authorName: secret.displayName, canEdit: true, canReclaim: true });
  expect(await store.detail(id, owner)).toMatchObject({ message: secret.message, authorName: secret.displayName, canEdit: true, canRemove: true });

  const icon = await store.create({ ...gift, requestId: "icon", message: " \n ", visibility: "private" }, sender);
  expect(icon.gifts.find((item) => item.id === icon.createdGiftId)).toMatchObject({ visibility: "public", message: null, authorName: sender.visitor.name });
  const owned = await store.create(gift, owner);
  expect(owned.gifts.find((item) => item.id === owned.createdGiftId)).toMatchObject({ authorName: "Kaio", message: gift.message });
});

test("version-checked edits retain CMS identity/lifecycle and cannot overwrite a newer private CMS edit", async () => {
  const { db, store, sender, other, owner } = await fixture();
  const repository = new ContentRepository(db);
  const id = (await store.create({ ...gift, authorId: other.visitor.id, status: "draft" }, sender)).createdGiftId!;
  const original = (await repository.findById("gifts", id))!;
  const { version } = await store.detail(id, sender);
  expect(version).toBe(original.version);
  await expect(store.update(id, { ...gift, version }, other)).rejects.toMatchObject({ status: 403 });
  await expect(store.update(id, { ...gift, version }, stranger)).rejects.toMatchObject({ status: 401 });

  await store.update(id, { ...gift, version, message: "Sender edit", authorId: other.visitor.id,
    author_id: other.visitor.id, status: "draft", collection: "posts" }, sender);
  const edited = (await repository.findById("gifts", id))!;
  expect(edited).toMatchObject({ authorId: sender.visitor.id, status: "published", createdAt: original.createdAt,
    publishedAt: original.publishedAt, version: version + 1, data: { submission_hash: original.data.submission_hash } });

  await repository.update("gifts", id, { data: { message: "New private CMS note", visibility: "private" } });
  await expect(store.update(id, { ...gift, version: edited.version, message: "Stale public draft" }, sender)).rejects.toMatchObject({ status: 409 });
  expect(await repository.findById("gifts", id)).toMatchObject({ version: edited.version + 1,
    data: { message: "New private CMS note", visibility: "private" } });
  const current = await store.detail(id, owner);
  expect(current).toMatchObject({ message: "New private CMS note", authorName: sender.visitor.name });
  await store.update(id, { ...gift, version: current.version, displayName: current.authorName, message: "Owner edit", visibility: "private" }, owner);
  expect(await store.detail(id, sender)).toMatchObject({ message: "Owner edit", authorName: sender.visitor.name, version: current.version + 1 });
  expect((await repository.findById("gifts", id))?.authorId).toBe(sender.visitor.id);

  await repository.update("gifts", id, { status: "draft" });
  await expect(store.update(id, { ...gift, version: current.version + 1 }, sender)).rejects.toMatchObject({ status: 404 });
  expect(await store.snapshot()).toEqual({ gifts: [] });
});

test("only sender/owner can remove gifts, repeated removal is safe and edits never revive trash", async () => {
  const { db, store, sender, other, owner } = await fixture();
  const id = (await store.create(gift, sender)).createdGiftId!;
  const { version } = await store.detail(id, sender);
  await expect(store.remove(id, stranger)).rejects.toMatchObject({ status: 401 });
  await expect(store.remove(id, other)).rejects.toMatchObject({ status: 403 });
  expect((await store.remove(id, sender)).gifts).toEqual([]);
  expect((await store.remove(id, sender)).gifts).toEqual([]);
  await expect(store.update(id, { ...gift, version }, sender)).rejects.toMatchObject({ status: 404 });
  expect((await new ContentRepository(db).findByIdIncludingTrashed("gifts", id))?.data.message).toBe(gift.message);
  const second = (await store.create({ ...gift, requestId: "two" }, other)).createdGiftId!;
  expect((await store.remove(second, owner)).gifts).toEqual([]);
});
