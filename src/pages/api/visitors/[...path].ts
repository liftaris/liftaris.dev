import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, sameOrigin } from "../../../server/house/http";
import { HouseError } from "../../../server/house/errors";
import { visitorAuth, visitorHeaders } from "../../../server/house/visitor-auth";

export const ALL: APIRoute = async ({ request, url, params }) => {
  const allowed = (request.method === "POST" && params.path === "sign-in/anonymous") || (request.method === "GET" && params.path === "get-session");
  if (!allowed) return json({ error: "Not found." }, 404);
  try {
    if (request.method === "POST") sameOrigin(request);
    const headers = visitorHeaders(request);
    // Anonymous creation accepts no fields; never read or forward an unbounded body.
    const incoming = new Request(request.url, { method: request.method, headers });
    const result = await visitorAuth(env, url.origin).handler(incoming);
    const outgoing = new Headers(result.headers);
    outgoing.delete("set-cookie");
    outgoing.set("Cache-Control", "no-store");
    outgoing.set("Vary", "Authorization");
    return new Response(result.body, { status: result.status, headers: outgoing });
  } catch (error) {
    return error instanceof HouseError ? json({ error: error.message }, error.status) : json({ error: "Visitor identity is temporarily unavailable." }, 503);
  }
};
