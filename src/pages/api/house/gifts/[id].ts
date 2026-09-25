import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { houseResponse } from "../../../../server/house/http";

export const GET: APIRoute = (context) => houseResponse(context, env.HOUSE_OWNER_ID);
export const PATCH: APIRoute = GET;
export const DELETE: APIRoute = GET;
