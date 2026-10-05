import type { APIRoute } from "astro";
import { FALLBACK_TOTAL, FALLBACK_DAYS } from "../../../components/house/github-data";

export const GET: APIRoute = async () => {
  const username = "liftaris";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as {
        total?: { lastYear?: number };
        contributions?: Array<{ date: string; count: number; level: number }>;
      };
      if (Array.isArray(data.contributions) && data.contributions.length > 0) {
        return new Response(
          JSON.stringify({
            username,
            total: data.total?.lastYear ?? FALLBACK_TOTAL,
            days: data.contributions.map((c) => ({ date: c.date, count: c.count, level: c.level })),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
            },
          }
        );
      }
    }
  } catch {
    // Ignore network error and serve fallback
  }

  return new Response(
    JSON.stringify({
      username,
      total: FALLBACK_TOTAL,
      days: FALLBACK_DAYS,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800, s-maxage=1800",
      },
    }
  );
};
