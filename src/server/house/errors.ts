import { Schema } from "effect";
import type { HouseSnapshot } from "../../lib/house/types";

export class HouseError extends Schema.TaggedError<HouseError>()("HouseError", {
  status: Schema.Number,
  message: Schema.String,
  snapshot: Schema.optional(Schema.Unknown),
}) {}

export type HouseResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string; snapshot?: HouseSnapshot };

export function failure(status: number, message: string, snapshot?: HouseSnapshot): HouseError {
  return new HouseError({ status, message, snapshot });
}
