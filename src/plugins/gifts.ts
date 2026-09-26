import { definePlugin, PluginRouteError, type Database, type RouteContext } from "emdash";
import type { Kysely } from "kysely";
import { Schema } from "effect";
import { GIFT_METHODS } from "../lib/house/gift-api";
import { CmsHouseStore } from "../server/house/cms-store";
import { HouseError, failure } from "../server/house/errors";
import { sameOrigin } from "../server/house/http";
import { resolveCmsViewer } from "../server/house/visitor";

const GiftId = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100), Schema.isPattern(/^[a-zA-Z0-9_-]+$/));
const decodeId = Schema.decodeUnknownSync(GiftId);

interface Dependencies {
  database(): Promise<Kysely<Database>>;
  ownerId(): Promise<string | undefined>;
}

/** Request identity stays in the invocation; only dependency factories are shared. */
export function createPlugin(options: Partial<Dependencies> = {}) {
  // Native entrypoints are instantiated with {} when no options are configured.
  const dependencies: Dependencies = {
    database: async () => (await import("emdash/runtime")).getDb(),
    ownerId: async () => (await import("cloudflare:workers")).env.HOUSE_OWNER_ID,
    ...options,
  };
  async function invoke(ctx: RouteContext, action: "snapshot" | "public-gift" | "gift" | "create" | "update") {
    try {
      if (ctx.request.method !== "GET") {
        sameOrigin(ctx.request);
        if (ctx.request.method !== "DELETE" && ctx.request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
          throw failure(415, "Send a JSON request.");
        }
      }
      const publicRead = action === "snapshot" || action === "public-gift";
      if (!publicRead && ctx.request.headers.has("Authorization")) throw failure(403, "Use this browser's visitor identity.");
      const db = await dependencies.database();
      const store = new CmsHouseStore(db);
      await store.initialize();
      if (action === "snapshot") return await store.snapshot();
      const viewer = publicRead ? { visitor: null, owner: false }
        : await resolveCmsViewer(db, ctx.user?.id, await dependencies.ownerId());
      if (!publicRead && !viewer.visitor) throw failure(401, "Your visitor identity is needed for this action.");
      if (action === "create") return await store.create(ctx.input, viewer);
      const ids = new URL(ctx.request.url).searchParams.getAll("id");
      let id: string;
      try { id = decodeId(ids.length === 1 ? ids[0] : undefined); }
      catch { throw failure(400, "Choose a gift from this portfolio."); }
      if (ctx.request.method === "GET") return await store.detail(id, viewer);
      if (ctx.request.method === "DELETE") return await store.remove(id, viewer);
      return await store.update(id, ctx.input, viewer);
    } catch (error) {
      if (error instanceof HouseError) throw new PluginRouteError(`GIFT_${error.status}`, error.message, error.status);
      throw error;
    }
  }

  return definePlugin({
    id: "liftaris-gifts",
    version: "1.0.0",
    // Trusted native plugin: core repositories retain authorship/idempotent IDs.
    // Visitors themselves keep subscriber permissions, never CMS write access.
    routes: {
      snapshot: {
        public: true, methods: [...GIFT_METHODS.snapshot], request: { body: "none" },
        handler: (ctx) => invoke(ctx, "snapshot"),
      },
      "public-gift": {
        public: true, methods: [...GIFT_METHODS["public-gift"]], request: { body: "none" },
        handler: (ctx) => invoke(ctx, "public-gift"),
      },
      create: {
        public: false, permission: "content:read", methods: [...GIFT_METHODS.create], request: { body: "json", maxBytes: 16_384 },
        handler: (ctx) => invoke(ctx, "create"),
      },
      update: {
        public: false, permission: "content:read", methods: [...GIFT_METHODS.update], request: { body: "json", maxBytes: 16_384 },
        handler: (ctx) => invoke(ctx, "update"),
      },
      gift: {
        public: false, permission: "content:read", methods: [...GIFT_METHODS.gift], request: { body: "none" },
        handler: (ctx) => invoke(ctx, "gift"),
      },
    },
  });
}
