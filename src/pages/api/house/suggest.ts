import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { suggestionResponse } from "../../../server/house/suggest";

export const POST: APIRoute = (context) => suggestionResponse(context, env.JEV_API_KEY);
