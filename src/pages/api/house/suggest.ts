import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Effect, Schema } from "effect";
import { EmojiSuggestions } from "../../../lib/house/suggestions";

const Input = Schema.Struct({ text: Schema.String.check(Schema.isMaxLength(1200)) });
const decode = Schema.decodeUnknownEffect(Input);
const headers = { "Cache-Control": "no-store" };

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Different origin." }, { status: 403, headers });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Enter some text." }, { status: 400, headers });
  let input: typeof Input.Type;
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8000) {
        await reader.cancel();
        return Response.json({ error: "That text is too long." }, { status: 413, headers });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    input = await Effect.runPromise(decode(JSON.parse(new TextDecoder().decode(bytes))));
  } catch {
    return Response.json({ error: "Enter up to 1,200 characters." }, { status: 400, headers });
  } finally {
    reader.releaseLock();
  }
  const address = request.headers.get("CF-Connecting-IP") ?? "local";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (!await env.HOUSE.getByName("home").allowSuggestion(key)) {
    return Response.json({ error: "Give it a moment, then try again." }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
  }
  const program = Effect.gen(function* () {
    const suggestions = yield* EmojiSuggestions;
    return yield* suggestions.suggest(input.text, request.signal);
  }).pipe(Effect.provide(EmojiSuggestions.layer(env.JEV_API_KEY)));
  return Response.json(await Effect.runPromise(program), { headers });
};
