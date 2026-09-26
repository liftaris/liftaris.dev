import type { APIContext } from "astro";
import { UserRepository, type Database } from "emdash";
import { DateTime, Schema } from "effect";
import type { Kysely } from "kysely";
import type { Viewer } from "../../lib/house/types";
import { GIFT_API, GIFT_METHODS } from "../../lib/house/gift-api";
import { failure, HouseError } from "./errors";
import { takeQuota } from "./rate-limit";
import { isHouseOwner } from "./owner-policy";

export interface VisitorSession {
  get(key: "user"): Promise<unknown>;
  set(key: "user", value: { id: string; lastRenewedAt?: number }, options?: { ttl?: number }): void;
  regenerate(): Promise<void>;
}

const ANIMALS = ["Capybara", "Otter", "Puffin", "Axolotl", "Panda", "Wombat", "Quokka", "Badger", "Hedgehog", "Octopus", "Fox", "Koala", "Raccoon", "Manta", "Kiwi", "Lemur"];
export const VISITOR_SESSION_SECONDS = 34_560_000; // Browsers cap cookies at 400 days.
const VISITOR_RENEWAL_MS = 86_400_000;

const decodeIdentity = Schema.decodeUnknownSync(Schema.Struct({
  id: Schema.NonEmptyString, lastRenewedAt: Schema.optional(Schema.Int),
}));
const decodeMetadata = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({ anonymous: Schema.optional(Schema.Boolean) })));

async function sessionUser(db: Kysely<Database>, session: VisitorSession | undefined) {
  if (!session) throw failure(503, "Browser sessions are unavailable. Try again.");
  // Do not catch storage failures and interpret them as a new browser.
  const value = await session.get("user");
  if (value === undefined) return null;
  let identity: ReturnType<typeof decodeIdentity>;
  try { identity = decodeIdentity(value); }
  catch { throw failure(401, "This browser identity is no longer available."); }
  return { ...await activeUser(db, identity.id), lastRenewedAt: identity.lastRenewedAt };
}

async function activeUser(db: Kysely<Database>, id: string) {
  // UserRepository omits disabled in its public DTO. Verify the persisted flag.
  const row = await db.selectFrom("users").select(["id", "name", "data", "disabled"])
    .where("id", "=", id).executeTakeFirst();
  if (!row || row.disabled) throw failure(401, "This browser identity is no longer available.");
  const anonymous = row.data ? decodeMetadata(row.data).anonymous === true : false;
  return { id: row.id, name: row.name || "Visitor", anonymous };
}

function viewerFor(user: Awaited<ReturnType<typeof activeUser>> | null, ownerId: string | undefined): Viewer {
  const owner = isHouseOwner(ownerId, user?.id) && !user?.anonymous;
  return { visitor: user && (user.anonymous || owner) ? { id: user.id, name: user.name } : null, owner };
}

/** Accept only EmDash's authenticated caller, never an ID from gift input. */
export async function resolveCmsViewer(db: Kysely<Database>, id: string | undefined, ownerId: string | undefined): Promise<Viewer> {
  return viewerFor(id ? await activeUser(db, id) : null, ownerId);
}

export async function resolveViewer(db: Kysely<Database>, session: VisitorSession | undefined, ownerId: string | undefined): Promise<Viewer> {
  return viewerFor(await sessionUser(db, session), ownerId);
}

export async function ensureCmsVisitor(db: Kysely<Database>, session: VisitorSession, ownerId: string | undefined, clientKey = "unknown"): Promise<Viewer> {
  const existing = await sessionUser(db, session);
  if (existing) {
    const viewer = viewerFor(existing, ownerId);
    if (!viewer.visitor) throw failure(403, "This account cannot leave gifts.");
    if (existing.anonymous) {
      const now = DateTime.toEpochMillis(DateTime.nowUnsafe());
      // Keep recent boots read-only: Astro persists the whole session to KV,
      // which permits only one write per key per second. Upgrade legacy values
      // once; keep renewal metadata inside EmDash's native user session key.
      if (existing.lastRenewedAt === undefined || now - existing.lastRenewedAt >= VISITOR_RENEWAL_MS) {
        session.set("user", { id: existing.id, lastRenewedAt: now }, { ttl: VISITOR_SESSION_SECONDS });
      }
    }
    return viewer;
  }
  const setup = await db.selectFrom("options").select("value").where("name", "=", "emdash:setup_complete").executeTakeFirst();
  if (!setup || !["true", '"true"'].includes(setup.value)) throw failure(503, "The house is not ready for visitors yet.");
  if (!await takeQuota(db, `house:visitor:${clientKey}`, 30, 3600)) throw failure(429, "Too many new visitors. Try again later.");
  const user = await new UserRepository(db).create({
    email: `${crypto.randomUUID()}@visitors.invalid`,
    name: ANIMALS[crypto.getRandomValues(new Uint32Array(1))[0] % ANIMALS.length],
    role: "subscriber", data: { anonymous: true },
  });
  await session.regenerate();
  session.set("user", { id: user.id, lastRenewedAt: DateTime.toEpochMillis(DateTime.nowUnsafe()) }, { ttl: VISITOR_SESSION_SECONDS });
  return { visitor: { id: user.id, name: user.name! }, owner: false };
}

export async function visitorDb(context: APIContext): Promise<Kysely<Database>> {
  // EmDash's anonymous public fast path intentionally does not expose locals.db.
  return context.locals.emdash?.db ?? (await import("emdash/runtime")).getDb();
}

/** Native cookie identity only; bearer credentials never grant gift ownership. */
export async function getViewer(context: APIContext, ownerId?: string): Promise<Viewer> {
  if (arguments.length < 2) ownerId = (await import("cloudflare:workers")).env.HOUSE_OWNER_ID;
  return resolveViewer(await visitorDb(context), context.session, ownerId);
}

const decodeBootstrap = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Never)));

async function validateBootstrap(request: Request): Promise<void> {
  if (request.headers.get("Origin") !== new URL(request.url).origin) throw failure(403, "This action must come from this portfolio.");
  if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw failure(415, "Send a JSON request.");
  const reader = request.body?.getReader();
  if (!reader) throw failure(400, "Send an empty JSON object.");
  let body = "";
  let size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 1024) { await reader.cancel(); throw failure(413, "That request is too large."); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
  } finally { reader.releaseLock(); }
  try { decodeBootstrap(body); }
  catch { throw failure(400, "Send an empty JSON object."); }
}

const privateJson = (value: unknown, status = 200) => Response.json(value, {
  status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" },
});

/** Shared by the actual GET/POST route and database-backed protocol tests. */
export async function visitorResponse(context: APIContext, ownerId: string | undefined): Promise<Response> {
  context.cache.set(false);
  try {
    if (context.request.method === "GET") return privateJson(await getViewer(context, ownerId));
    if (context.request.method !== "POST") return privateJson({ error: "Method not allowed." }, 405);
    await validateBootstrap(context.request);
    const { session } = context;
    if (!session) throw failure(503, "Browser sessions are unavailable. Try again.");
    // Intentional fail-closed: a stale/native empty cookie is not proof of a new
    // browser. Native logout removes it; owner passkey login remains available
    // through the perimeter even with a stale cookie and replaces the user key.
    // Astro can delete an unreadable session cookie during upstream soft auth.
    // Preserve the evidence from the original request, not just its mutable jar.
    const arrivedWithSession = /(?:^|;)\s*astro-session\s*=/.test(context.request.headers.get("Cookie") ?? "");
    if ((arrivedWithSession || context.cookies.get("astro-session")) && await session.get("user") === undefined) {
      throw failure(401, "This browser identity is no longer available.");
    }
    // Only Cloudflare's edge-overwritten header is trusted; local/unknown callers
    // share a bounded bucket rather than bypassing the limiter with a fake IP.
    const clientKey = "cf" in context.request ? context.request.headers.get("CF-Connecting-IP") || "unknown" : "unknown";
    const viewer = await ensureCmsVisitor(await visitorDb(context), session, ownerId, clientKey);
    if (viewer.visitor && !viewer.owner) {
      const id = session.sessionID;
      if (!id) throw failure(503, "Browser sessions are unavailable. Try again.");
      const { lastRenewedAt } = decodeIdentity(await session.get("user"));
      if (lastRenewedAt === undefined) throw failure(503, "Browser sessions are unavailable. Try again.");
      // A read-only boot must not keep the browser cookie beyond server expiry.
      const maxAge = Math.max(0, Math.min(VISITOR_SESSION_SECONDS,
        Math.floor((lastRenewedAt + VISITOR_SESSION_SECONDS * 1000 - DateTime.toEpochMillis(DateTime.nowUnsafe())) / 1000)));
      context.cookies.set("astro-session", id, {
        path: "/", httpOnly: true, sameSite: "lax", secure: context.url.protocol === "https:", maxAge,
      });
    }
    return privateJson(viewer);
  } catch (error) {
    return error instanceof HouseError ? privateJson({ error: error.message }, error.status)
      : privateJson({ error: "Your visitor identity could not be checked. Try again." }, 503);
  }
}

/**
 * Runs after EmDash auth, which skips user resolution on its public auth/search
 * routes. Resolve the cookie ourselves and also inspect upstream bearer users.
 * Deny-by-default for every non-owner prevents native published-content APIs
 * from leaking private gift fields even when a caller omits their visitor cookie.
 */
export async function cmsVisitorGuard(context: APIContext, ownerId: string | undefined): Promise<Response | null> {
  let path: string;
  try { path = decodeURIComponent(context.url.pathname).replace(/\/{2,}/g, "/"); }
  catch { return privateJson({ error: "Invalid CMS path." }, 400); }
  if (!path.startsWith("/_emdash")) {
    // Native request-context middleware runs before project middleware and has
    // already computed isEditor. Do not render its draft/toolbar path for a
    // mistakenly promoted visitor (changing locals.role here would be too late).
    if (context.locals.user && context.locals.user.role >= 30 && !path.startsWith("/api/house/")) {
      try {
        const user = await activeUser(await visitorDb(context), context.locals.user.id);
        if (user.anonymous) return privateJson({ error: "Visitor accounts cannot use CMS editing." }, 403);
      } catch { return privateJson({ error: "CMS identity could not be checked. Try again." }, 503); }
    }
    return null;
  }
  const method = context.request.method;
  const exactPath = path === context.url.pathname;
  // Authentication only, never registration, OAuth consent, signup, or invites.
  if (exactPath && (method === "GET" || method === "HEAD") && (path === "/_emdash/admin/login" || path === "/_emdash/api/auth/mode")) return null;
  if (exactPath && method === "POST" && (path === "/_emdash/api/auth/passkey/options" || path === "/_emdash/api/auth/passkey/verify")) return null;
  if (exactPath && (method === "GET" || method === "HEAD") && path.startsWith("/_emdash/api/media/file/")) return null;

  context.cache.set(false);
  const giftRoute = Object.entries(GIFT_METHODS).find(([route, methods]) =>
    exactPath && path === `${GIFT_API}/${route}` && (methods as readonly string[]).includes(method))?.[0];
  // Public routes cannot receive a caller from EmDash and always redact secrets.
  if (giftRoute === "snapshot" || giftRoute === "public-gift") return null;
  try {
    const db = await visitorDb(context);
    const cookieUser = await sessionUser(db, context.session);
    const nativeUser = context.locals.user?.id ? await activeUser(db, context.locals.user.id) : null;
    const marked = cookieUser?.anonymous || nativeUser?.anonymous;
    // A token must not turn a marked cookie account into an editorial account.
    const current = nativeUser ?? cookieUser;
    const owner = isHouseOwner(ownerId, current?.id) && !marked;
    if (giftRoute) {
      if (context.request.headers.has("Authorization") || ("tokenScopes" in context.locals && context.locals.tokenScopes)) {
        return privateJson({ error: "Use this browser's visitor identity." }, 403);
      }
      // Match the native caller to the cookie before delegating to plugin auth.
      // No cookie is allowed through only so EmDash returns its native 401.
      if (cookieUser?.id !== nativeUser?.id || (cookieUser && !marked && !owner)) {
        return privateJson({ error: "This account cannot leave gifts." }, 403);
      }
      return null;
    }
    if (owner) return null;
    if (method === "GET" && path === "/_emdash/api/auth/me") {
      // Native auth/me has a safe field allowlist; clamp role even if an admin
      // accidentally promoted an anonymous account in the CMS.
      if (marked && context.locals.user) context.locals.user.role = 10;
      return null;
    }
    if (method === "POST" && path === "/_emdash/api/auth/logout") return null;
    return privateJson({ error: "The CMS is only available to the portfolio owner." }, 403);
  } catch (error) {
    return error instanceof HouseError ? privateJson({ error: error.message }, error.status)
      : privateJson({ error: "CMS identity could not be checked. Try again." }, 503);
  }
}
