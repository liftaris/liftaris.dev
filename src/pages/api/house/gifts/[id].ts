import type { APIRoute } from "astro";
import { Effect } from "effect";
import { call, house, response, run, sameOrigin, viewer } from "../../../../server/house/http";
import { failure } from "../../../../server/house/errors";

export const GET: APIRoute = (context) => run(Effect.gen(function*() {
  const identity = yield* viewer(context);
  return response(yield* call(async () => await house().detail(context.params.id ?? "", identity)));
}));

export const DELETE: APIRoute = (context) => run(Effect.gen(function*() {
  yield* Effect.try({ try: () => sameOrigin(context.request), catch: () => failure(403, "This action must come from this portfolio.") });
  const identity = yield* viewer(context);
  return response(yield* call(async () => await house().remove(context.params.id ?? "", identity)));
}));
