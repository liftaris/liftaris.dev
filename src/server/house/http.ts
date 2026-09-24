import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { Effect } from "effect";
import type { Viewer } from "../../lib/house/types";
import { failure, HouseError, type HouseResult } from "./errors";
import { visitorAuth, visitorHeaders } from "./visitor-auth";
import { isHouseOwner } from "./owner-policy";

export const house = () => env.HOUSE.getByName("home");

export function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", Vary: "Authorization, Cookie" } });
}

export function response<T>(result: HouseResult<T>): Response {
  return result.ok ? json(result.value) : json({ error: result.error, ...(result.snapshot ? { snapshot: result.snapshot } : {}) }, result.status);
}

export function sameOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  if (origin !== new URL(request.url).origin) throw failure(403, "This action must come from this portfolio.");
}

export const viewer = Effect.fn("House.viewer")(function*(context: APIContext) {
  const owner = isHouseOwner(env.HOUSE_OWNER_ID, context.locals.user?.id);
  if (!context.request.headers.has("Authorization")) return { visitor: null, owner } satisfies Viewer;
  const session = yield* Effect.tryPromise({
    try: () => visitorAuth(env, context.url.origin).api.getSession({ headers: visitorHeaders(context.request) }),
    catch: () => failure(503, "Your visitor identity could not be checked. Try again."),
  });
  if (!session) return yield* failure(401, "This visitor identity is no longer available in this browser.");
  return { visitor: { id: session.user.id, name: session.user.name }, owner } satisfies Viewer;
});

export function readBody(request: Request): Effect.Effect<unknown, HouseError> {
  return Effect.tryPromise({
    try: async () => {
      sameOrigin(request);
      if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) throw failure(415, "Send a JSON request.");
      const reader = request.body?.getReader();
      if (!reader) throw failure(400, "A request body is required.");
      const parts: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.byteLength;
          if (length > 16_384) { await reader.cancel(); throw failure(413, "That message is too long."); }
          parts.push(chunk.value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const part of parts) { bytes.set(part, offset); offset += part.length; }
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    },
    catch: (error) => error instanceof HouseError ? error : failure(400, "That request could not be read."),
  });
}

export function run(program: Effect.Effect<Response, HouseError>): Promise<Response> {
  return Effect.runPromise(program.pipe(
    Effect.catch((error) => Effect.succeed(json({ error: error.message }, error.status))),
  )).catch(() => json({ error: "The house is temporarily unavailable. Try again." }, 503));
}

export const call = <A>(task: () => Promise<A>) => Effect.tryPromise({
  try: task, catch: () => failure(503, "The house is temporarily unavailable. Try again."),
});
