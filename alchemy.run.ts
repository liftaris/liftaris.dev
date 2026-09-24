import { Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Config, Effect } from "effect";
import type { House } from "./src/server/house/House";

// This stack owns preview runtime state, but only binds the existing shared CMS.
// Production resources remain owned by Wrangler, never adopted by this stack.
// Build with the existing Astro adapter first so EmDash's fetch/scheduled
// handlers, House export, and Vite-generated module layout stay intact.
export default Stack(
  "liftaris-house-preview",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const cmsDatabaseId = "0e886ca8-384e-4090-8035-c187268c7da7";
    const visitors = yield* Cloudflare.D1.Database("Visitors", {
      migrations: "./migrations/visitor-auth",
    });
    const sessions = yield* Cloudflare.KV.Namespace("Sessions");

    const website = yield* Cloudflare.Worker("Website", {
      main: "./dist/server/entry.mjs",
      bundle: false,
      assets: "./dist/client",
      compatibility: { date: "2026-09-22", flags: ["nodejs_compat"] },
      workersDev: true,
      observability: { enabled: true },
      env: {
        SESSION: sessions,
        VISITOR_DB: visitors,
        HOUSE: Cloudflare.DurableObject<House>("House", { className: "House" }),
        EMDASH_SETUP_KEY: Config.Redacted("EMDASH_SETUP_KEY"),
        VISITOR_AUTH_SECRET: Config.Redacted("VISITOR_AUTH_SECRET"),
        JEV_API_KEY: Config.Redacted("JEV_API_KEY"),
        HOUSE_OWNER_ID: Config.String("HOUSE_OWNER_ID").pipe(Config.withDefault("")),
      },
    });

    // Raw bindings reference shared storage without managing its lifecycle.
    // Scheduled CMS publishing stays exclusively on the production Worker.
    yield* website.bind`shared-cms`({
      bindings: [
        { type: "d1", name: "DB", databaseId: cmsDatabaseId },
        { type: "r2_bucket", name: "MEDIA", bucketName: "liftaris-emdash-media" },
      ],
    });

    return {
      url: website.url,
      workerName: website.workerName,
      visitorDatabaseId: visitors.databaseId,
      cmsDatabaseId,
    };
  }),
);
