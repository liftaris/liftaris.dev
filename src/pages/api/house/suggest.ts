import type { APIRoute } from "astro";
import { suggestionResponse } from "../../../server/house/suggest";

export const POST: APIRoute = suggestionResponse;
