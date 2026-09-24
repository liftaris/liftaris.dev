import { Effect, Schema } from "effect";
import { failure } from "./errors";

const Identifier = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100), Schema.isPattern(/^[a-zA-Z0-9_-]+$/));
const Coordinate = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(100_000));

export const CreateGiftSchema = Schema.Struct({
  requestId: Identifier,
  emojiId: Identifier,
  message: Schema.optional(Schema.String.check(Schema.isMaxLength(2_000))),
  visibility: Schema.Literals(["public", "private"]),
  displayName: Schema.optional(Schema.String.check(Schema.isMaxLength(60))),
});

export const PlaceObjectSchema = Schema.Struct({
  baseRevision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  pose: Schema.Struct({
    id: Identifier,
    x: Coordinate,
    y: Coordinate,
    angle: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(-10_000), Schema.isLessThanOrEqualTo(10_000)),
  }),
});

export const decodeGift = (input: unknown) => Schema.decodeUnknownEffect(CreateGiftSchema)(input).pipe(
  Effect.mapError(() => failure(400, "Check the gift, name, and message and try again.")),
);
export const decodePlacement = (input: unknown) => Schema.decodeUnknownEffect(PlaceObjectSchema)(input).pipe(
  Effect.mapError(() => failure(400, "That placement is not valid.")),
);
