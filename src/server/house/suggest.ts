import type { APIContext } from "astro";
import { Effect, Schema } from "effect";
import { EmojiSuggestions } from "../../lib/house/suggestions";
import { digest } from "./cms-schema";
import { failure } from "./errors";
import { call, json, readBody, run } from "./http";
import { takeQuota } from "./rate-limit";
import { visitorDb } from "./visitor";

const Input = Schema.Struct({ text: Schema.String.check(Schema.isMaxLength(1200)) });

export function suggestionResponse(context: APIContext, apiKey?: string): Promise<Response> {
  context.cache.set(false);
  return run(Effect.gen(function*() {
    const raw = yield* readBody(context.request);
    const input = yield* Schema.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => failure(400, "Enter up to 1,200 characters.")));
    const db = yield* call(() => visitorDb(context));
    const address = "cf" in context.request ? context.request.headers.get("CF-Connecting-IP") || "unknown" : "unknown";
    const key = yield* call(() => digest(address));
    if (!(yield* call(() => takeQuota(db, `house:suggest:${key}`, 120))) || !(yield* call(() => takeQuota(db, "house:suggest:global", 600)))) {
      const response = json({ error: "Give it a moment, then try again." }, 429);
      response.headers.set("Retry-After", "60");
      return response;
    }
    const suggestions = yield* EmojiSuggestions;
    return json(yield* suggestions.suggest(input.text, context.request.signal));
  }).pipe(Effect.provide(EmojiSuggestions.layer(apiKey))));
}
