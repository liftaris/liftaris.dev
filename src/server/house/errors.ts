import { Schema } from "effect";

export class HouseError extends Schema.TaggedError<HouseError>()("HouseError", {
  status: Schema.Number,
  message: Schema.String,
}) {}

export function failure(status: number, message: string): HouseError {
  return new HouseError({ status, message });
}
