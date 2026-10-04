import { Schema } from "effect";

export const Identifier = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100), Schema.isPattern(/^[a-zA-Z0-9_-]+$/));

export const CreateGiftSchema = Schema.Struct({
  requestId: Identifier,
  emojiId: Identifier,
  message: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(400)),
  authorName: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(60)),
  location: Schema.optional(Schema.String.check(Schema.isMaxLength(60))),
});

export const UpdateGiftSchema = Schema.Struct({
  emojiId: Identifier,
  message: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(400)),
  authorName: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(60)),
  location: Schema.optional(Schema.String.check(Schema.isMaxLength(60))),
});
