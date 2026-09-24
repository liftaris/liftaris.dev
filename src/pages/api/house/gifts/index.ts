import type { APIRoute } from "astro";
import { Effect } from "effect";
import { call, house, readBody, response, run, viewer } from "../../../../server/house/http";

export const POST: APIRoute = (context) => run(Effect.gen(function*() {
  const input = yield* readBody(context.request);
  const identity = yield* viewer(context);
  return response(yield* call(async () => await house().create(input, identity)));
}));
