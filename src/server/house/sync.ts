import { Option, Schema } from "effect";
import { HOUSE_COLLECTION } from "../../lib/house/collection";

const decodeSync = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Struct({
  channel: Schema.Literal(HOUSE_COLLECTION),
  sync: Schema.Literal(true),
  from: Schema.optional(Schema.Unknown),
})), { onExcessProperty: "error" });

/** The public channel is read-only; never dispatch client frames to SyncServer actions/SQL. */
export function isPublicSyncRequest(message: unknown): boolean {
  return typeof message === "string" && message.length <= 4_096 && Option.isSome(decodeSync(message));
}
