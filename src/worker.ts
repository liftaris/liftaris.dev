import handler, { createScheduledHandler } from "@emdash-cms/cloudflare/worker";

// Retained for the applied namespace migration; deleting it would destroy storage.
export { House } from "./server/house/House";

// EmDash and Astro own media response headers, including mutable image revalidation.
export default {
  ...handler,
  scheduled: createScheduledHandler(),
} satisfies ExportedHandler<Env>;
