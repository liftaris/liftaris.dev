import { Context, DateTime, Effect, Layer } from "effect";
import type { GiftDetail, HouseSnapshot, Viewer } from "../../lib/house/types";
import { failure, HouseError, type HouseResult } from "./errors";
import { decodeGift, decodePlacement } from "./schemas";
import type { HouseStore } from "./store";

const stored = <A>(run: () => A) => Effect.try({
  try: run,
  catch: (error) => error instanceof HouseError ? error : failure(500, "The house could not save this change. Try again."),
});

export class HouseService extends Context.Service<HouseService, {
  snapshot(): Effect.Effect<HouseSnapshot, HouseError>;
  detail(id: string, viewer: Viewer): Effect.Effect<GiftDetail, HouseError>;
  create(input: unknown, viewer: Viewer): Effect.Effect<HouseSnapshot, HouseError>;
  remove(id: string, viewer: Viewer): Effect.Effect<HouseSnapshot, HouseError>;
  place(input: unknown, viewer: Viewer): Effect.Effect<HouseSnapshot, HouseError>;
  allowSuggestion(key: string): Effect.Effect<boolean, HouseError>;
}>()("portfolio/house/HouseService") {
  static layer(store: HouseStore) {
    return Layer.succeed(HouseService, HouseService.of({
      snapshot: () => stored(() => store.snapshot()),
      detail: (id, viewer) => stored(() => store.detail(id, viewer)),
      create: Effect.fn("House.create")(function*(input, viewer) {
        const command = yield* decodeGift(input);
        const now = yield* DateTime.now;
        // A receipt can survive withdrawal without retaining the withdrawn message.
        const payload = JSON.stringify({
          emojiId: command.emojiId, message: command.message?.trim() || null,
          name: command.displayName?.trim() || viewer.visitor?.name || "Kaio",
          visibility: command.message?.trim() ? command.visibility : "public",
        });
        const hash = yield* Effect.tryPromise({
          try: () => crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload)),
          catch: () => failure(500, "The house could not save this gift. Try again."),
        });
        const fingerprint = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
        return yield* stored(() => store.create(viewer, command, DateTime.formatIso(now), DateTime.toEpochMillis(now), fingerprint));
      }),
      remove: (id, viewer) => stored(() => store.remove(viewer, id)),
      place: Effect.fn("House.place")(function*(input, viewer) {
        const command = yield* decodePlacement(input);
        const now = yield* DateTime.now;
        return yield* stored(() => store.place(viewer, command, DateTime.toEpochMillis(now)));
      }),
      allowSuggestion: Effect.fn("House.allowSuggestion")(function*(key) {
        const now = yield* DateTime.now;
        return yield* stored(() => store.allowSuggestion(key, DateTime.toEpochMillis(now)));
      }),
    }));
  }
}

export const result = <A, R>(program: Effect.Effect<A, HouseError, R>) => program.pipe(
  Effect.map((value): HouseResult<A> => ({ ok: true, value })),
  Effect.catch((error) => Effect.succeed<HouseResult<A>>({
    ok: false, status: error.status, error: error.message,
    ...(error.snapshot ? { snapshot: error.snapshot as HouseSnapshot } : {}),
  })),
);
