import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import memoryDriver from "unstorage/drivers/memory";
import { UserRepository } from "emdash";
import { cmsTestDb } from "./cms-test-db";
import { createStorage } from "unstorage";
import { AstroCookies } from "../../../node_modules/astro/dist/core/cookies/cookies.js";
import { AstroSession, PERSIST_SYMBOL } from "../../../node_modules/astro/dist/core/session/runtime.js";
import type { APIContext } from "astro";
import { cmsVisitorGuard, ensureCmsVisitor, resolveViewer, visitorResponse, type VisitorSession } from "./visitor";

class Session implements VisitorSession {
  value: unknown;
  writes = 0;
  rotations = 0;
  ttl: number | undefined;
  constructor(value?: unknown) { this.value = value; }
  async get() { return this.value; }
  set(_key: "user", value: { id: string }, options?: { ttl?: number }) {
    this.value = value; this.writes++; this.ttl = options?.ttl;
  }
  async regenerate() { this.rotations++; }
}

let fixture: Awaited<ReturnType<typeof cmsTestDb>>;
beforeEach(async () => { fixture = await cmsTestDb(); });
afterEach(async () => { await fixture.db.destroy(); });

async function completeSetup() {
  await fixture.db.insertInto("options").values({ name: "emdash:setup_complete", value: "true" })
    .onConflict((oc) => oc.column("name").doUpdateSet({ value: "true" })).execute();
}

test("only marked visitors and the exact unmarked owner receive gift identity", async () => {
  const users = new UserRepository(fixture.db);
  const member = await users.create({ email: "member@example.invalid", role: "admin" });
  expect(await resolveViewer(fixture.db, new Session({ id: member.id }), fixture.owner.id))
    .toEqual({ visitor: null, owner: false });
  const ownerSession = new Session({ id: fixture.owner.id });
  expect(await ensureCmsVisitor(fixture.db, ownerSession, fixture.owner.id))
    .toEqual({ visitor: { id: fixture.owner.id, name: "Kaio" }, owner: true });
  expect(ownerSession.writes).toBe(0);
  await users.update(fixture.sender.id, { role: "admin" });
  expect(await resolveViewer(fixture.db, new Session({ id: fixture.sender.id }), fixture.sender.id))
    .toEqual({ visitor: { id: fixture.sender.id, name: "Capybara" }, owner: false });
});

test.each(["disabled", "deleted", "malformed", "member", "setup", "storage-error"])("bootstrap fails closed for %s without replacing identity", async (reason) => {
  await completeSetup();
  const session = new Session({ id: fixture.sender.id, lastRenewedAt: Date.now() });
  if (reason === "disabled") await fixture.db.updateTable("users").set({ disabled: 1 }).where("id", "=", fixture.sender.id).execute();
  if (reason === "deleted") await new UserRepository(fixture.db).delete(fixture.sender.id);
  if (reason === "malformed") session.value = { id: "" };
  if (reason === "member") {
    const user = await new UserRepository(fixture.db).create({ email: "member@example.invalid" });
    session.value = { id: user.id };
  }
  if (reason === "setup") {
    session.value = undefined;
    await fixture.db.deleteFrom("options").where("name", "=", "emdash:setup_complete").execute();
  }
  if (reason === "storage-error") session.get = async () => { throw new Error("KV unavailable"); };
  const before = await new UserRepository(fixture.db).count();
  const identity = session.value;
  await expect(ensureCmsVisitor(fixture.db, session, fixture.owner.id)).rejects.toThrow();
  expect(await new UserRepository(fixture.db).count()).toBe(before);
  expect(session.value).toEqual(identity);
  expect(session.writes).toBe(0);
  expect(session.rotations).toBe(0);
});

test("bootstrap bounds new accounts in the existing CMS rate-limit table", async () => {
  await completeSetup();
  for (let i = 0; i < 30; i++) await ensureCmsVisitor(fixture.db, new Session(), fixture.owner.id);
  await expect(ensureCmsVisitor(fixture.db, new Session(), fixture.owner.id)).rejects.toMatchObject({ status: 429 });
  expect(await new UserRepository(fixture.db).count()).toBe(33);
  // Existing identities do not consume bootstrap allowance.
  expect((await ensureCmsVisitor(fixture.db, new Session({ id: fixture.sender.id }), fixture.owner.id)).visitor?.id).toBe(fixture.sender.id);
});

test("bootstrap keeps recent visitor identity read-only, never extends an owner's", async () => {
  await completeSetup();
  const session = new Session();
  await ensureCmsVisitor(fixture.db, session, fixture.owner.id);
  expect(session.ttl).toBe(34_560_000);
  const writes = session.writes;
  await ensureCmsVisitor(fixture.db, session, fixture.owner.id);
  expect(session.writes).toBe(writes);
  const owner = new Session({ id: fixture.owner.id });
  await ensureCmsVisitor(fixture.db, owner, fixture.owner.id);
  expect(owner.writes).toBe(0);
  const legacy = new Session({ id: fixture.sender.id });
  await ensureCmsVisitor(fixture.db, legacy, fixture.owner.id);
  await ensureCmsVisitor(fixture.db, legacy, fixture.owner.id);
  expect(legacy.writes).toBe(1);
  expect(legacy.value).toEqual({ id: fixture.sender.id, lastRenewedAt: expect.any(Number) });
});

function contextFor(request: Request, session = new Session()) {
  const cookies = new Map<string, { value: string; options?: Record<string, unknown> }>();
  const context = {
    request, url: new URL(request.url), session: Object.assign(session, { sessionID: crypto.randomUUID() }),
    locals: { emdash: { db: fixture.db } }, cache: { set: () => {} },
    cookies: {
      get: (key: string) => cookies.get(key),
      set: (key: string, value: string, options: Record<string, unknown>) => { cookies.set(key, { value, options }); },
    },
  } as unknown as APIContext;
  return { context, cookies, session };
}
const origin = "https://www.liftaris.dev";
const bootstrapRequest = (headers: Record<string, string> = {}, body = "{}") => new Request(`${origin}/api/house/me`, {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...headers }, body,
});

test("session endpoint boots with a persistent cookie and verifies identity read-only", async () => {
  await completeSetup();
  const { context, cookies, session } = contextFor(bootstrapRequest());
  const response = await visitorResponse(context, fixture.owner.id);
  expect(response.status).toBe(200);
  const viewer = await response.json();
  expect(cookies.get("astro-session")?.options).toEqual({ path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: expect.any(Number) });
  expect(cookies.get("astro-session")?.options?.maxAge).toBeLessThanOrEqual(34_560_000);
  expect(cookies.get("astro-session")?.options?.maxAge).toBeGreaterThanOrEqual(34_559_999);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  const writes = session.writes;
  const read = contextFor(new Request(`${origin}/api/house/me`), session);
  const verification = await visitorResponse(read.context, fixture.owner.id);
  expect(JSON.stringify(await verification.json())).toBe(JSON.stringify(viewer));
  expect(session.writes).toBe(writes);
  expect(read.cookies.size).toBe(0);
});

test("real Astro boots respect KV's one write per key per second", async () => {
  await completeSetup();
  let now = Date.now();
  const clock = spyOn(Date, "now").mockImplementation(() => now);
  const driver = memoryDriver();
  const writes = new Map<string, number[]>();
  const storage = createStorage({ driver: {
    ...driver,
    setItem(key, value, options) {
      const history = writes.get(key) ?? [];
      if (history.length && now - history[history.length - 1] < 1000) throw new Error("KV write/key/sec exceeded");
      history.push(now);
      writes.set(key, history);
      return driver.setItem!(key, value, options);
    },
  } });
  const boot = async (cookie?: string, expectedStatus = 200) => {
    const request = bootstrapRequest(cookie ? { Cookie: cookie } : {});
    const logger = { warn: () => {}, error: () => {} } as unknown as ConstructorParameters<typeof AstroSession>[0]["logger"];
    const cookies = new AstroCookies(request, logger);
    const session = new AstroSession({
      cookies, config: { driver: "memory", cookie: "astro-session" },
      runtimeMode: "production", driverFactory: null, mockStorage: storage, logger,
    });
    const response = await visitorResponse({ ...contextFor(request).context, cookies, session } as APIContext, fixture.owner.id);
    expect(response.status).toBe(expectedStatus);
    await session[PERSIST_SYMBOL]();
    return { viewer: await response.json(), session, header: [...cookies.headers()][0] };
  };
  try {
    const initial = await boot();
    const cookie = initial.header.split(";", 1)[0];
    const id = initial.session.sessionID!;
    now += 2;
    const repeated = await boot(cookie);
    expect(repeated.viewer).toEqual(initial.viewer);
    expect(writes.get(id)).toHaveLength(1);
    now += 60_000;
    const later = await boot(cookie);
    expect(writes.get(id)).toHaveLength(1);
    expect(later.header).toContain("Max-Age=34559939");
    const createdAt = writes.get(id)![0];
    now = createdAt + 86_400_000 - 1;
    await boot(cookie);
    expect(writes.get(id)).toHaveLength(1);
    now += 1;
    const renewed = await boot(cookie);
    expect(renewed.viewer).toEqual(initial.viewer);
    expect(renewed.header).toContain("Max-Age=34560000");
    expect(writes.get(id)).toHaveLength(2);
    now += 2;
    expect((await boot(cookie)).viewer).toEqual(initial.viewer);
    expect(writes.get(id)).toHaveLength(2);
    // The renewed native TTL really expires; a stale cookie cannot provision
    // a replacement user or trigger another persistence write.
    now += 34_560_000_000;
    await boot(cookie, 401);
    expect(writes.get(id)).toHaveLength(2);
    expect(await new UserRepository(fixture.db).count()).toBe(4);
  } finally {
    clock.mockRestore();
    await storage.dispose();
  }
});

test("real Astro sessions round-trip the visitor cookie and keep native login browser-scoped", async () => {
  await completeSetup();
  const storage = createStorage();
  const requestContext = (request: Request) => {
    const logger = { warn: () => {}, error: () => {} } as unknown as ConstructorParameters<typeof AstroSession>[0]["logger"];
    const cookies = new AstroCookies(request, logger);
    const session = new AstroSession({
      cookies, config: { driver: "memory", cookie: { name: "astro-session", path: "/", sameSite: "lax" } },
      runtimeMode: "production", driverFactory: null, mockStorage: storage, logger,
    });
    const context = { ...contextFor(request).context, cookies, session } as APIContext;
    return { context, session, cookies };
  };
  const initial = requestContext(bootstrapRequest());
  const response = await visitorResponse(initial.context, fixture.owner.id);
  expect(response.status).toBe(200);
  await initial.session[PERSIST_SYMBOL]();
  const identity = await response.json();
  const setCookie = [...initial.cookies.headers()].find((value) => value.startsWith("astro-session="))!;
  expect(setCookie).toMatch(/Max-Age=(34560000|34559999);/);
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("Secure");
  expect(setCookie).toContain("SameSite=Lax");
  const returned = requestContext(new Request(`${origin}/api/house/me`, { headers: { Cookie: setCookie.split(";", 1)[0] } }));
  expect(JSON.stringify(await (await visitorResponse(returned.context, fixture.owner.id)).json())).toBe(JSON.stringify(identity));
  // EmDash's successful passkey verify sets exactly this key. It must replace
  // the visitor TTL and persistent cookie with the native owner defaults.
  returned.session.set("user", { id: fixture.owner.id });
  await returned.session[PERSIST_SYMBOL]();
  expect([...returned.cookies.headers()].join(";")).not.toContain("Max-Age");
  expect((await resolveViewer(fixture.db, returned.session, fixture.owner.id)).owner).toBe(true);
  const ownerBoot = requestContext(bootstrapRequest({ Cookie: setCookie.split(";", 1)[0] }));
  const beforeOwnerBoot = await storage.getItem(returned.session.sessionID!);
  expect((await visitorResponse(ownerBoot.context, fixture.owner.id)).status).toBe(200);
  await ownerBoot.session[PERSIST_SYMBOL]();
  expect([...ownerBoot.cookies.headers()]).toEqual([]);
  expect(await storage.getItem(returned.session.sessionID!)).toEqual(beforeOwnerBoot);
  expect(await ownerBoot.session.get("user")).toEqual({ id: fixture.owner.id });
  await storage.dispose();
});

test.each([
  ["cross-origin", { Origin: "https://evil.invalid" }, "{}", 403],
  ["missing-origin", { Origin: "" }, "{}", 403],
  ["content-type", { "Content-Type": "text/plain" }, "{}", 415],
  ["oversized", {}, " ".repeat(2048), 413],
  ["metadata", {}, '{"role":"admin"}', 400],
] as const)("session endpoint rejects %s before provisioning", async (_name, headers, body, status) => {
  await completeSetup();
  const { context, session } = contextFor(bootstrapRequest(headers, body));
  const response = await visitorResponse(context, fixture.owner.id);
  expect(response.status).toBe(status);
  expect(await new UserRepository(fixture.db).count()).toBe(3);
  expect(session.writes).toBe(0);
});

test("session endpoint does not silently replace an unreadable existing cookie", async () => {
  await completeSetup();
  const { context, cookies, session } = contextFor(bootstrapRequest());
  cookies.set("astro-session", { value: crypto.randomUUID() });
  expect((await visitorResponse(context, fixture.owner.id)).status).toBe(401);
  expect(session.writes).toBe(0);
  expect(await new UserRepository(fixture.db).count()).toBe(3);
});

test("bootstrap preserves incoming identity evidence when upstream Astro deletes an unreadable cookie", async () => {
  await completeSetup();
  const storage = createStorage();
  const id = crypto.randomUUID();
  const request = bootstrapRequest({ Cookie: `other=value; astro-session=${id}` });
  const logger = { warn: () => {}, error: () => {} } as unknown as ConstructorParameters<typeof AstroSession>[0]["logger"];
  const cookies = new AstroCookies(request, logger);
  const session = new AstroSession({
    cookies, config: { driver: "memory", cookie: "astro-session" },
    runtimeMode: "production", driverFactory: null, mockStorage: storage, logger,
  });
  try {
    await storage.setItem(id, "invalid serialized session");
    // EmDash's upstream soft-auth path catches this failure before our endpoint.
    await expect(session.get("user")).rejects.toThrow();
    expect(cookies.get("astro-session")).toBeUndefined();
    const context = { ...contextFor(request).context, cookies, session } as APIContext;
    expect((await visitorResponse(context, fixture.owner.id)).status).toBe(401);
    expect(await new UserRepository(fixture.db).count()).toBe(3);
    expect(await session.get("user")).toBeUndefined();
  } finally { await storage.dispose(); }
});

test.each([
  "/_emdash/api/content/gifts", "/_emdash/api/content/posts", "/_emdash/api/content/gifts/abc",
  "/_emdash/api/users", "/_emdash/api/media", "/_emdash/api/settings", "/_emdash/api/schema/collections",
  "/_emdash/api/plugins/theme-image", "/_emdash/api/mcp", "/_emdash/admin", "/_emdash/admin/users",
  "/_emdash/api/auth/signup/complete", "/_emdash/api/auth/invite/accept", "/_emdash/api/auth/register",
  "/_emdash/api/auth/passkey/register/options", "/_emdash/api/auth/passkey/register/verify",
  "/_emdash/api/oauth/authorize", "/_emdash/oauth/authorize", "/_emdash/api/oauth/token", "/_emdash/api/oauth/device/authorize",
  "/_emdash/api/api-tokens", "/_emdash/api/search", "/_emdash/api/search/suggest", "/_emdash/api/snapshot",
  "/_emdash/api/auth/me/extra", "/_emdash/api/auth/passkey/options/extra",
  "/_emdash/api/setup", "/_emdash/api/auth/dev-bypass", "/_emdash/api/auth/oauth/google/callback",
])("CMS visitor perimeter blocks %s even on native public-auth paths", async (path) => {
  const { context } = contextFor(new Request(`${origin}${path}`), new Session({ id: fixture.sender.id }));
  expect((await cmsVisitorGuard(context, fixture.owner.id))?.status).toBe(403);
});

test.each(["cookie-free", "subscriber", "promoted-visitor", "bearer-visitor", "owner"])("CMS gift reads require the owner: %s", async (kind) => {
  const session = new Session();
  if (kind === "owner") session.value = { id: fixture.owner.id };
  if (kind === "subscriber") {
    const member = await new UserRepository(fixture.db).create({ email: "member@example.invalid" });
    session.value = { id: member.id };
  }
  if (kind === "promoted-visitor") {
    await new UserRepository(fixture.db).update(fixture.sender.id, { role: "admin" });
    session.value = { id: fixture.sender.id };
  }
  const request = new Request(`${origin}/_emdash/api/content/gifts`, { headers: kind === "bearer-visitor" ? { Authorization: "Bearer verified-upstream" } : {} });
  const { context } = contextFor(request, session);
  if (kind === "bearer-visitor") context.locals.user = { id: fixture.sender.id, role: 50 } as App.Locals["user"];
  expect((await cmsVisitorGuard(context, fixture.owner.id))?.status ?? 200).toBe(kind === "owner" ? 200 : 403);
});

test.each([
  ["GET", "/_emdash/admin/login"], ["GET", "/_emdash/api/auth/mode"],
  ["POST", "/_emdash/api/auth/passkey/options"], ["POST", "/_emdash/api/auth/passkey/verify"],
  ["GET", "/_emdash/api/auth/me"], ["POST", "/_emdash/api/auth/logout"],
  ["GET", "/_emdash/api/media/file/image.webp"], ["HEAD", "/_emdash/api/media/file/image.webp"],
  ["GET", "/_astro/client.js"], ["GET", "/posts/public-post"],
])("CMS perimeter retains %s %s for visitors", async (method, path) => {
  const { context } = contextFor(new Request(`${origin}${path}`, { method }), new Session({ id: fixture.sender.id }));
  expect(await cmsVisitorGuard(context, fixture.owner.id)).toBeNull();
});

test("promoted visitors cannot enter native visual editing on public pages", async () => {
  await new UserRepository(fixture.db).update(fixture.sender.id, { role: "admin" });
  const { context } = contextFor(new Request(`${origin}/?edit=true`), new Session({ id: fixture.sender.id }));
  context.locals.user = { id: fixture.sender.id, role: 50, data: { anonymous: true } } as unknown as App.Locals["user"];
  expect((await cmsVisitorGuard(context, fixture.owner.id))?.status).toBe(403);
});

test("encoded CMS namespaces do not bypass the gift perimeter", async () => {
  const { context } = contextFor(new Request(`${origin}/%5femdash/api/content/gifts`), new Session({ id: fixture.sender.id }));
  expect((await cmsVisitorGuard(context, fixture.owner.id))?.status).toBe(403);
});

test("auth/me is read-only for visitors", async () => {
  const { context } = contextFor(new Request(`${origin}/_emdash/api/auth/me`, { method: "POST" }), new Session({ id: fixture.sender.id }));
  expect((await cmsVisitorGuard(context, fixture.owner.id))?.status).toBe(403);
});

test("bootstrap creates a native subscriber and restores the same identity", async () => {
  await completeSetup();
  const session = new Session();
  const viewer = await ensureCmsVisitor(fixture.db, session, fixture.owner.id);
  expect(viewer.owner).toBe(false);
  expect(viewer.visitor?.name).toBeTruthy();
  const user = await new UserRepository(fixture.db).findById(viewer.visitor!.id);
  expect(user?.role).toBe(10);
  expect(user?.data).toEqual({ anonymous: true });
  expect(user?.email).toMatch(/^[a-f0-9-]+@visitors\.invalid$/);
  expect(session.value).toEqual({ id: user!.id, lastRenewedAt: expect.any(Number) });
  expect(session.rotations).toBe(1);
  expect(await resolveViewer(fixture.db, session, fixture.owner.id)).toEqual(viewer);
  expect(await ensureCmsVisitor(fixture.db, session, fixture.owner.id)).toEqual(viewer);
  expect(await new UserRepository(fixture.db).count()).toBe(4);
  expect(Object.keys(viewer.visitor!).sort()).toEqual(["id", "name"]);
});
