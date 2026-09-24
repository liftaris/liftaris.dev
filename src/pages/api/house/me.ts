import type { APIRoute } from "astro";
import { Effect } from "effect";
import { json, run, viewer } from "../../../server/house/http";

export const GET: APIRoute = (context) => run(viewer(context).pipe(Effect.map((value) => json(value))));
