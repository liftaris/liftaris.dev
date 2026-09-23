import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";

// Protect first-admin registration on the public site until the owner creates
// their passkey. Afterwards EmDash's normal session authentication takes over.
export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.hostname === "liftaris.dev") {
    const canonical = new URL(context.url);
    canonical.hostname = "www.liftaris.dev";
    canonical.protocol = "https:";
    return context.redirect(canonical.href, 308);
  }
  if (import.meta.env.DEV || !context.url.pathname.startsWith("/_emdash/")) return next();
  const option = await context.locals.emdash?.db
    .selectFrom("options").select("value")
    .where("name", "=", "emdash:setup_complete").executeTakeFirst();
  if (option && [true, "true"].includes(JSON.parse(option.value))) return next();

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
