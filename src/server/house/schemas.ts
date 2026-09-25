import { Schema } from "effect";

const Identifier = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100), Schema.isPattern(/^[a-zA-Z0-9_-]+$/));

const GiftFields = {
  emojiId: Identifier,
  message: Schema.optional(Schema.String.check(Schema.isMaxLength(2_000))),
  visibility: Schema.Literals(["public", "private"]),
  displayName: Schema.optional(Schema.String.check(Schema.isMaxLength(60))),
};

export const CreateGiftSchema = Schema.Struct({ ...GiftFields, requestId: Identifier });
export const UpdateGiftSchema = Schema.Struct(GiftFields);
