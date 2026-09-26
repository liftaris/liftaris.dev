import { afterEach, expect, mock, test } from "bun:test";
import type { APIContext } from "astro";
import { ContentRepository, HookPipeline, UserRepository } from "emdash";
import { cmsTestDb } from "../server/house/cms-test-db";
import { cmsVisitorGuard } from "../server/house/visitor";
import { GIFT_API } from "../lib/house/gift-api";
import type { CreatedGift, GiftDetail } from "../lib/house/types";
import { createPlugin } from "./gifts";
import * as client from "../lib/house/client";

// Astro generates this configuration module. Only the host module is supplied;
// the published runtime, dispatcher, authentication policy and DB are real.
mock.module("virtual:emdash/config", () => ({ default: {} }));
const { EmDashRuntime, dispatchPluginApiRequest } = await import("emdash/plugin-test-runtime");

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanups.splice(0)) await close(); });
const input = { requestId: "test", emojiId: "seedling", message: "Only the sender and owner", displayName: "Secret sender", visibility: "private" };
const origin = "https://portfolio.test";

async function fixture() {
  const { db, sender, other, owner } = await cmsTestDb();
  cleanups.push(() => db.destroy());
  const plugin = createPlugin({ database: async () => db, ownerId: async () => owner.id });
  const hooks = new HookPipeline([plugin], { db });
  const runtime = new EmDashRuntime({
    db, storage: null, configuredPlugins: [plugin], sandboxedPlugins: new Map(), sandboxedPluginEntries: [],
    hooks, enabledPlugins: new Set([plugin.id]), pluginStates: new Map([[plugin.id, "active"]]), config: {},
    mediaProviders: new Map(), mediaProviderEntries: [], cronExecutor: null, cronScheduler: null, emailPipeline: null,
    allPipelinePlugins: [plugin], pipelineFactoryOptions: { db }, pipelineRef: { current: hooks },
    runtimeDeps: { config: {}, plugins: [plugin], createDialect: () => { throw new Error("Use the migrated test database"); },
      createStorage: null, sandboxEnabled: false, sandboxedPluginEntries: [], createSandboxRunner: null },
  });
  const request = async (route: string, method: string, actor: string | null, body?: unknown, headers: Record<string, string> = {}, cookieActor: string | null = actor) => {
    const url = new URL(`${GIFT_API}/${route}`, origin);
    const user = actor ? await new UserRepository(db).findById(actor) : null;
    const requestHeaders = new Headers({ Origin: origin, "Content-Type": "application/json", "X-EmDash-Request": "1" });
    new Headers(headers).forEach((value, name) => requestHeaders.set(name, value));
    const req = new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: requestHeaders });
    const context = { request: req, url, locals: { user, emdash: runtime },
      session: { get: async () => cookieActor ? { id: cookieActor } : undefined }, cache: { set() {} } } as unknown as APIContext;
    const denied = await cmsVisitorGuard(context, owner.id);
    if (denied) return denied;
    return dispatchPluginApiRequest({ runtime, pluginId: plugin.id, path: url.pathname.slice(GIFT_API.length), request: req, user });
  };
  return { db, sender, other, owner, request, runtime };
}

async function data<T>(response: Response): Promise<T> {
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  return (await response.json() as { data: T }).data;
}

test("native plugin preserves cookie-only ownership, redaction, edits, conflicts and durable revoke receipts", async () => {
  const { db, sender, other, owner, request } = await fixture();
  const created = await data<CreatedGift>(await request("create", "POST", sender.id, { ...input, authorId: other.id, collection: "posts", status: "draft" }));
  const id = created.createdGiftId!;
  expect(created.gifts[0]).toMatchObject({ message: null, authorName: null });
  const repository = new ContentRepository(db);
  expect(await repository.findById("gifts", id)).toMatchObject({ authorId: sender.id, status: "published" });
  for (const actor of [null, other.id, sender.id, owner.id]) {
    const snapshot = await data(await request("snapshot", "GET", actor));
    const publicDetail = await data<GiftDetail>(await request(`public-gift?id=${id}`, "GET", actor));
    expect(publicDetail).toMatchObject({ message: null, authorName: null, canEdit: false, canRemove: false });
    expect(JSON.stringify({ snapshot, publicDetail })).not.toContain(input.message);
    expect(JSON.stringify({ snapshot, publicDetail })).not.toContain(input.displayName);
    expect(JSON.stringify({ snapshot, publicDetail })).not.toContain(sender.id);
  }
  expect(await data<GiftDetail>(await request(`gift?id=${id}`, "GET", other.id))).toMatchObject({ message: null, canEdit: false });
  expect(await data<GiftDetail>(await request(`gift?id=${id}`, "GET", owner.id))).toMatchObject({ message: input.message, canRemove: true });
  const detail = await data<GiftDetail>(await request(`gift?id=${id}`, "GET", sender.id));
  expect(detail).toMatchObject({ message: input.message, authorName: input.displayName, canEdit: true });
  for (const invalid of [undefined, null, "1", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect((await request(`update?id=${id}`, "PATCH", sender.id, { ...input, version: invalid })).status).toBe(400);
  }
  expect((await request(`update?id=${id}`, "PATCH", sender.id, { ...input, version: detail.version, message: "x".repeat(20_000) })).status).toBe(413);
  for (const method of ["PATCH", "DELETE"]) {
    expect((await request(`${method === "PATCH" ? "update" : "gift"}?id=${id}`, method, other.id, method === "PATCH" ? { ...input, version: detail.version } : undefined)).status).toBe(403);
  }
  expect((await request(`update?id=${id}`, "PATCH", sender.id, { ...input, version: detail.version, message: "Edited" })).status).toBe(200);
  const conflict = await request(`update?id=${id}`, "PATCH", sender.id, { ...input, version: detail.version });
  expect(conflict.status).toBe(409);
  expect(conflict.headers.get("Cache-Control")).toContain("no-store");
  expect(await conflict.json()).toMatchObject({ error: { message: expect.stringContaining("Reload") } });
  expect((await request(`gift?id=${id}`, "DELETE", sender.id)).status).toBe(200);
  expect((await request(`gift?id=${id}`, "DELETE", sender.id)).status).toBe(200);
  await repository.permanentDelete("gifts", id);
  expect(await data<CreatedGift>(await request("create", "POST", sender.id, input))).toEqual({ gifts: [], createdGiftId: null });
});

test("native routes enforce authentication, CSRF, bounded parsing, safe fields and exact methods", async () => {
  const { sender, other, request, runtime } = await fixture();
  expect((await request("create", "POST", null, input)).status).toBe(401);
  expect((await request("create", "POST", sender.id, input, { Origin: "https://other.test" })).status).toBe(403);
  expect((await request("create", "POST", sender.id, input, { "X-EmDash-Request": "" })).status).toBe(403);
  expect((await request("create", "POST", sender.id, input, { "Content-Type": "text/plain" })).status).toBe(415);
  expect((await request("create", "POST", sender.id, input, { Authorization: "Bearer verified-upstream" })).status).toBe(403);
  expect((await request("create", "POST", sender.id, input, {}, other.id)).status).toBe(403);
  expect((await request("create", "POST", sender.id, { ...input, message: "x".repeat(20_000) })).status).toBe(413);
  for (const invalid of [{ emojiId: "invalid" }, { message: "x".repeat(2001) }, { displayName: "x".repeat(61) }, { requestId: "bad/id" }]) {
    expect((await request("create", "POST", sender.id, { ...input, ...invalid })).status).toBe(400);
  }
  for (const id of ["", "bad/id", "valid&id=other"]) {
    expect((await request(`gift?id=${id}`, "GET", sender.id)).status).toBe(400);
  }
  // Exercise native method enforcement independently of the stricter site guard.
  const wrongMethod = await dispatchPluginApiRequest({ runtime, pluginId: "liftaris-gifts", path: "/snapshot", request: new Request(`${origin}${GIFT_API}/snapshot`, { method: "POST" }) });
  expect(wrongMethod.status).toBe(405);
  expect(wrongMethod.headers.get("Allow")).toBe("GET");
  expect((await request("create/extra", "POST", sender.id, input)).status).toBe(403);
});

test("the real frontend client speaks the native plugin protocol, including unauthenticated public reads", async () => {
  const { sender, request } = await fixture();
  const originalFetch = globalThis.fetch;
  let actor: string | null = null;
  globalThis.fetch = (async (path, init = {}) => {
    expect(init.credentials).toBe("same-origin");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).get("X-EmDash-Request")).toBe("1");
    expect(String(path).startsWith(`${GIFT_API}/`)).toBe(true);
    return request(String(path).slice(GIFT_API.length + 1), init.method ?? "GET", actor,
      init.body ? JSON.parse(String(init.body)) : undefined, Object.fromEntries(new Headers(init.headers)));
  }) as typeof fetch;
  try {
    expect(await client.getHouse()).toEqual({ gifts: [] });
    actor = sender.id;
    const created = await client.createGift({ ...input, visibility: "private" });
    const id = created.createdGiftId!;
    const detail = await client.getGift(id);
    expect(detail.message).toBe(input.message);
    actor = null;
    expect(await client.getGift(id)).toMatchObject({ message: null, authorName: null, canEdit: false });
    actor = sender.id;
    await client.updateGift(id, { ...input, visibility: "public", version: detail.version });
    actor = null;
    expect(await client.getGift(id)).toMatchObject({ message: input.message, canEdit: false });
    actor = sender.id;
    expect(await client.reclaimGift(id)).toEqual({ gifts: [] });
  } finally { globalThis.fetch = originalFetch; }
});

test("disabled, malformed and editorial identities fail closed at the plugin perimeter", async () => {
  const { db, sender, request } = await fixture();
  const users = new UserRepository(db);
  const editor = await users.create({ email: "editor@example.invalid", role: "admin" });
  expect((await request("create", "POST", editor.id, input)).status).toBe(403);
  await users.update(sender.id, { role: "admin" });
  expect((await request("create", "POST", sender.id, input)).status).toBe(200);
  await db.updateTable("users").set({ disabled: 1 }).where("id", "=", sender.id).execute();
  expect((await request("create", "POST", sender.id, input)).status).toBe(401);
  await db.updateTable("users").set({ disabled: 0, data: JSON.stringify({ anonymous: "not-a-boolean" }) }).where("id", "=", sender.id).execute();
  expect((await request("create", "POST", sender.id, input)).status).toBe(503);
});
