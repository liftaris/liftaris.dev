import { Effect, Schema } from "effect";
import { failure } from "./errors";

const Identifier = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100), Schema.isPattern(/^[a-zA-Z0-9_-]+$/));

export const CreateGiftSchema = Schema.Struct({
  requestId: Identifier,
  emojiId: Identifier,
  message: Schema.optional(Schema.String.check(Schema.isMaxLength(2_000))),
  visibility: Schema.Literals(["public", "private"]),
  displayName: Schema.optional(Schema.String.check(Schema.isMaxLength(60))),
});

export const decodeGift = (input: unknown) => Schema.decodeUnknownEffect(CreateGiftSchema)(input).pipe(
  Effect.mapError(() => failure(400, "Check the gift, name, and message and try again.")),
);
