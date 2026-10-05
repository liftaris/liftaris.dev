import handler, { createScheduledHandler } from "@emdash-cms/cloudflare/worker";

// EmDash and Astro own media response headers, including mutable image revalidation.
export default {
  ...handler,
  scheduled: createScheduledHandler(),
} satisfies ExportedHandler<Env>;
