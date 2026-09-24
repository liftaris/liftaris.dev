import type { APIRoute } from "astro";
import { Effect } from "effect";
import { call, house, response, run } from "../../../server/house/http";

export const GET: APIRoute = () => run(Effect.gen(function*() {
  return response(yield* call(async () => await house().snapshot()));
}));
