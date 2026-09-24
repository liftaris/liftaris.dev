import type { APIRoute } from "astro";
import { house, json } from "../../../server/house/http";

export const GET: APIRoute = async ({ request }) => {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return json({ error: "Open the house on this portfolio." }, 403);
  return house().fetch(request);
};
