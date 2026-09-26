import handler, { createScheduledHandler } from "@emdash-cms/cloudflare/worker";
import { handleMediaCache } from "./lib/house/media-cache";

export { House } from "./server/house/House";

export default {
  ...handler,
  fetch(request: Request, env: unknown, ctx: { waitUntil: (promise: Promise<unknown>) => void }): Promise<Response> {
    return handleMediaCache(
      request,
      async (req) => {
        const res = handler.fetch?.(req as never, env as never, ctx as never);
        return res instanceof Promise ? await res : (res ?? new Response("Not Found", { status: 404 }));
      },
      (p) => ctx.waitUntil(p),
    );
  },
  scheduled: createScheduledHandler(),
};
