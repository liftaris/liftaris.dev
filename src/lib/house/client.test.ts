import { afterEach, expect, test } from "bun:test";
import { ensureVisitor } from "./client";
import * as client from "./client";

const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else Reflect.deleteProperty(globalThis, "navigator");
});

function withoutBrowserStorage() {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Storage is unavailable"); } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
}

test("concurrent anonymous initialization shares a cookie-only POST and verifies the persisted session", async () => {
  withoutBrowserStorage();
  const visitor = { id: "visitor-1", name: "Quiet Otter" };
  const calls: { path: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (path, init = {}) => {
    calls.push({ path: String(path), init });
    return Response.json({ visitor, owner: false });
  }) as typeof fetch;

  const first = ensureVisitor();
  expect(ensureVisitor()).toBe(first);
  expect(await first).toEqual(visitor);
  expect(calls.map(({ path, init }) => [path, init.method ?? "GET", init.body])).toEqual([
    ["/api/house/me", "POST", "{}"], ["/api/house/me", "GET", undefined],
  ]);
  for (const { init } of calls) {
    expect(init.credentials).toBe("same-origin");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  }
});

test("later initialization rechecks the cookie inside the cross-tab lock, including owner identities", async () => {
  withoutBrowserStorage();
  const visitor = { id: "cms-owner", name: "Kaio" };
  let locked = false;
  let locks = 0;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: {
    async request(name: string, work: () => Promise<unknown>) {
      expect(name).toBe("kaio.house.visitor");
      locks++;
      locked = true;
      try { return await work(); } finally { locked = false; }
    },
  } } });
  globalThis.fetch = (async (path: RequestInfo | URL) => {
    expect(String(path)).toBe("/api/house/me");
    expect(locked).toBe(true);
    return Response.json({ visitor, owner: true });
  }) as typeof fetch;

  expect(await ensureVisitor()).toEqual(visitor);
  expect(await ensureVisitor()).toEqual(visitor);
  expect(locks).toBe(2);
});

test("missing or changed cookie identity rejects, then allows retry", async () => {
  withoutBrowserStorage();
  const visitor = { id: "visitor-1", name: "Quiet Otter" };
  for (const persisted of [null, { id: "someone-else", name: "Another Owl" }]) {
    globalThis.fetch = (async (_path, init) => Response.json({ visitor: init?.method === "POST" ? visitor : persisted, owner: false })) as typeof fetch;
    await expect(ensureVisitor()).rejects.toThrow("Enable cookies");
  }
  globalThis.fetch = (async (path: RequestInfo | URL) => {
    expect(String(path)).toBe("/api/house/me");
    return Response.json({ visitor, owner: false });
  }) as typeof fetch;
  expect(await ensureVisitor()).toEqual(visitor);
});

test("PATCH sends the editable fields with only cookie credentials and returns the fresh snapshot", async () => {
  withoutBrowserStorage();
  const update = { emojiId: "heart", message: "Updated note", visibility: "private" as const, displayName: "Friend" };
  const snapshot = { gifts: [{ id: "gift/one", ...update, authorName: "Friend", message: null, createdAt: "2026-09-24" }] };
  const calls: { path: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (path, init = {}) => {
    calls.push({ path: String(path), init });
    return Response.json(snapshot);
  }) as typeof fetch;
  expect(typeof client.updateGift).toBe("function");
  expect(await client.updateGift("gift/one", update)).toEqual(snapshot);
  expect(calls).toHaveLength(1);
  expect(calls[0].path).toBe("/api/house/gifts/gift%2Fone");
  expect(calls[0].init.method).toBe("PATCH");
  expect(JSON.parse(calls[0].init.body as string)).toEqual(update);
  expect(calls[0].init.credentials).toBe("same-origin");
  expect(new Headers(calls[0].init.headers).has("Authorization")).toBe(false);
});

test("HTTP authorization errors preserve the server message and status", async () => {
  withoutBrowserStorage();
  globalThis.fetch = (async (path: RequestInfo | URL) => {
    expect(String(path)).toBe("/api/house/gifts/not-mine");
    return Response.json({ error: "You can only edit your own gifts." }, { status: 403 });
  }) as typeof fetch;
  const failure = await client.updateGift("not-mine", { emojiId: "gift", visibility: "public" }).catch((reason: unknown) => reason);
  expect(failure).toBeInstanceOf(client.HouseError);
  expect(failure).toMatchObject({ status: 403, message: "You can only edit your own gifts." });
});
