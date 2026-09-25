import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { visitorResponse } from "../../../server/house/visitor";

export const prerender = false;
export const GET: APIRoute = (context) => visitorResponse(context, env.HOUSE_OWNER_ID);
export const POST: APIRoute = (context) => visitorResponse(context, env.HOUSE_OWNER_ID);
