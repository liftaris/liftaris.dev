import { defineMiddleware, sequence } from "astro:middleware";
import { withThingReads } from "./server/things/request-cache";
import { finalizeResponseCache } from "./server/things/page-cache";
import { env } from "cloudflare:workers";
import { cmsVisitorGuard, visitorDb } from "./server/house/visitor";
import { MEDIA_CACHE_TAG } from './server/cache-tags';
import { GIFT_API } from './lib/house/gift-api';

// Protect first-admin registration on the public site until the owner creates
// their passkey. Afterwards EmDash's normal session authentication takes over.
const applicationMiddleware = defineMiddleware(async (context, next) => {
  if (context.url.hostname === "liftaris.dev") {
    context.cache.set(false);
    const canonical = new URL(context.url);
    canonical.hostname = "www.liftaris.dev";
    canonical.protocol = "https:";
    const response = context.redirect(canonical.href, 308);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
    return response;
  }
  let path: string;
  try { path = decodeURIComponent(context.url.pathname).replace(/\/{2,}/g, "/"); }
  catch { return new Response("Invalid path.", { status: 400 }); }
  const cmsPath = path.startsWith("/_emdash");
  const guardedNext = async () => await cmsVisitorGuard(context, env.HOUSE_OWNER_ID) ?? next();
  if (!cmsPath) return guardedNext();
  context.cache.set(false);
  if (import.meta.env.DEV && (path === "/_emdash/api/setup/dev-bypass" || path === "/_emdash/api/auth/dev-bypass")) {
    return next();
  }
  // Only the initial setup flow bypasses the owner perimeter, behind the
  // pre-existing private setup key. DEV is not an auth bypass after setup.
  let setupComplete = false;
  try {
    const option = await (await visitorDb(context)).selectFrom("options").select("value")
      .where("name", "=", "emdash:setup_complete").executeTakeFirst();
    setupComplete = !!option && ["true", '"true"'].includes(option.value);
  } catch {
    return new Response("CMS setup could not be checked. Try again.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (setupComplete) return guardedNext();
  if (import.meta.env.DEV) return next();

  const secret = env.EMDASH_SETUP_KEY;
  const provided = context.url.searchParams.get("setup_key") || context.cookies.get("liftaris_setup")?.value;
  if (!secret || !provided || !await matches(secret, provided)) {
    return new Response("Use the private setup link to initialize this CMS.", {
      status: 403, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" },
    });
  }
  if (context.url.searchParams.has("setup_key")) {
    context.cookies.set("liftaris_setup", secret, { path: "/_emdash", secure: true, httpOnly: true, sameSite: "strict", maxAge: 3600 });
    const url = new URL(context.url);
    url.searchParams.delete("setup_key");
    return context.redirect(url.pathname + url.search, 303);
  }
  return next();
});

async function matches(expected: string, actual: string) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([expected, actual].map((value) => crypto.subtle.digest("SHA-256", encoder.encode(value))));
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

export const onRequest = sequence(
  defineMiddleware((context, next) => withThingReads(async () => {
    const path = context.url.pathname;
    const mutation = Boolean(context.locals.user) && !['GET', 'HEAD', 'OPTIONS'].includes(context.request.method) &&
        /^\/_emdash\/api\/(?:media|revisions|relations|plugins|import|mcp)(?:\/|$)/.test(path) &&
        !path.startsWith(GIFT_API);
    const invalidate = () => context.cache.invalidate({ tags: [MEDIA_CACHE_TAG] });
    let response: Response;
    try {
      response = await next();
    } finally {
      if (mutation) await invalidate();
    }
    if (mutation && response.body && /(?:text\/event-stream|application\/(?:x-ndjson|ndjson))/.test(response.headers.get('Content-Type') ?? '')) {
      const reader = response.body.getReader();
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              await invalidate();
              controller.close();
            } else controller.enqueue(value);
          } catch (error) {
            await invalidate();
            controller.error(error);
          }
        },
        async cancel(reason) {
          try { await reader.cancel(reason); }
          finally { await invalidate(); }
        },
      });
      response = new Response(body, response);
    }
    return finalizeResponseCache(context, response);
  })),
  applicationMiddleware,
);
