import { Option, Schema } from "effect";
import type { HouseSnapshot } from "./types";

export const HOUSE_COLLECTION = "house_collection";
/** Stable id + public snapshot + partysync's final three timestamp columns. */
export type HouseCollectionRecord = [id: "home", payload: string, createdAt: number, updatedAt: number, deletedAt: null];
export const HOUSE_SYNC_REQUEST = JSON.stringify({ channel: HOUSE_COLLECTION, sync: true });

export function collectionRecord(snapshot: HouseSnapshot): HouseCollectionRecord {
  return ["home", JSON.stringify(snapshot), 0, snapshot.revision, null];
}

const SnapshotSchema = Schema.Struct({
  revision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  gifts: Schema.Array(Schema.Struct({
    id: Schema.String,
    emojiId: Schema.String,
    authorName: Schema.String,
    createdAt: Schema.String,
    visibility: Schema.Literals(["public", "private"]),
    message: Schema.NullOr(Schema.String),
  })),
});
const decodeRecord = Schema.decodeUnknownOption(Schema.Tuple([
  Schema.Literal("home"), Schema.fromJsonString(SnapshotSchema),
  Schema.Number, Schema.Number, Schema.Null,
]));

/** Cache records are untrusted too; ignore malformed or inconsistent snapshots. */
export function collectionSnapshot(record: unknown): HouseSnapshot | undefined {
  const decoded = decodeRecord(record);
  if (Option.isNone(decoded)) return undefined;
  const [, snapshot, , revision] = decoded.value;
  return snapshot.revision === revision ? { revision, gifts: [...snapshot.gifts] } : undefined;
}
