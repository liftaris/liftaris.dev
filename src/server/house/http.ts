import { Effect } from "effect";
import { failure, HouseError } from "./errors";

export function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", Vary: "Authorization, Cookie" } });
}

export function sameOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  if (origin !== new URL(request.url).origin) throw failure(403, "This action must come from this portfolio.");
}

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
  try: task, catch: (error) => error instanceof HouseError ? error : failure(503, "The house is temporarily unavailable. Try again."),
});
