import handler, { createScheduledHandler } from "@emdash-cms/cloudflare/worker";

// EmDash and Astro own media response headers, including mutable image revalidation.
export default {
  ...handler,
  async fetch(request, env, ctx) {
    // Redirect before EmDash initializes or Astro applies route cache headers.
    const url = new URL(request.url);
    if (url.hostname === "liftaris.dev") {
      url.hostname = "www.liftaris.dev";
      url.protocol = "https:";
      return new Response(null, {
        status: 308,
        headers: {
          Location: url.href,
          "Cache-Control": "no-store",
          "Cloudflare-CDN-Cache-Control": "no-store",
        },
      });
    }
    // EmDash's exported type makes fetch optional; its Astro handler provides it.
    const response = await handler.fetch!(request, env, ctx);
    if (response.status === 101) return response;
    // Workers Cache omits hostname and runs before fetch. Keep cached www
    // responses from bypassing the apex redirect; preserve existing variants.
    const vary = response.headers.get("Vary")?.split(",").map((value) => value.trim().toLowerCase()) ?? [];
    const varied = new Response(response.body, response);
    if (!vary.includes("host") && !vary.includes("*")) varied.headers.append("Vary", "Host");
    varied.headers.set("X-Worker-Version", env.CF_VERSION_METADATA.id);
    return varied;
  },
  scheduled: createScheduledHandler(),
} satisfies ExportedHandler<Env>;
