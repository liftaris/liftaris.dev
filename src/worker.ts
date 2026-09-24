import handler, { createScheduledHandler } from "@emdash-cms/cloudflare/worker";

export { House } from "./server/house/House";

export default {
  ...handler,
  scheduled: createScheduledHandler(),
};
