import { cachePublicResponse } from "../../../server/things/page-cache";
import type { APIRoute } from "astro";
import { FALLBACK_TOTAL, FALLBACK_DAYS } from "../../../components/house/github-data";

export const GET: APIRoute = async (context) => {
  const username = "liftaris";
  try {
    const res = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`, {
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        total?: { lastYear?: number };
        contributions?: Array<{ date: string; count: number; level: number }>;
      };
      if (Array.isArray(data.contributions) && data.contributions.length > 0) {
        const headers = new Headers({ "Content-Type": "application/json" });
        cachePublicResponse(context, headers, { maxAge: 3600, tags: [] });
        return new Response(
          JSON.stringify({
            username,
            total: data.total?.lastYear ?? FALLBACK_TOTAL,
            days: data.contributions.map((c) => ({ date: c.date, count: c.count, level: c.level })),
          }),
          {
            status: 200,
            headers,
          }
        );
      }
    }
  } catch {
    // Ignore network error and serve fallback
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  cachePublicResponse(context, headers, { maxAge: 60, swr: 0, tags: [] });
  return new Response(
    JSON.stringify({
      username,
      total: FALLBACK_TOTAL,
      days: FALLBACK_DAYS,
    }),
    {
      status: 200,
      headers,
    }
  );
};
