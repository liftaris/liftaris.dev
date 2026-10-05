import { Schema } from "effect";
import { findEmoji } from "../../lib/house/emoji";

const EmojiId = Schema.String.check(Schema.makeFilter(value => Boolean(findEmoji(value))));

const Identifier = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100), Schema.isPattern(/^[a-zA-Z0-9_-]+$/));

const messageFields = {
  emojiId: EmojiId,
  message: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(400)),
  authorName: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(60)),
  location: Schema.optional(Schema.Trim.check(Schema.isMaxLength(60))),
};

export const CreateGiftSchema = Schema.Struct({ ...messageFields, requestId: Identifier });
export const UpdateGiftSchema = Schema.Struct({ ...messageFields, updatedAt: Schema.NonEmptyString });
