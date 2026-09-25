import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { houseResponse } from "../../../../server/house/http";

export const POST: APIRoute = (context) => houseResponse(context, env.HOUSE_OWNER_ID);
