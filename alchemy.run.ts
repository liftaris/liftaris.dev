import { RemovalPolicy, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Config, Effect } from "effect";
import type { House } from "./src/server/house/House";

// This stack owns preview sessions, but only binds the existing shared CMS.
// Production resources remain owned by Wrangler, never adopted by this stack.
// Build with the existing Astro adapter first so EmDash's fetch/scheduled
// handlers, House export, and Vite-generated module layout stay intact.
// Legacy declarations below are retirement holds, not app dependencies.
// Do not deploy or remove them before reviewing docs/legacy-gift-retirement.md.
export default Stack(
  "liftaris-house-preview",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const cmsDatabaseId = "0e886ca8-384e-4090-8035-c187268c7da7";
    // Persist retain in existing stage state before any later removal. Simply
    // deleting this declaration would destroy databases with the old policy.
    const legacyVisitors = yield* Cloudflare.D1.Database("Visitors", {
      migrations: "./migrations/visitor-auth",
    }).pipe(RemovalPolicy.retain());
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
        // Alchemy beta.79 emits deletedClasses if this declaration disappears.
        // Keep it bound to the inert export until legacy gifts are migrated.
        // No application route uses HOUSE; Wrangler needs no runtime binding.
        HOUSE: Cloudflare.DurableObject<House>("House", { className: "House" }),
        EMDASH_SETUP_KEY: Config.Redacted("EMDASH_SETUP_KEY"),
        JEV_API_KEY: Config.Redacted("JEV_API_KEY"),
        HOUSE_OWNER_ID: Config.String("HOUSE_OWNER_ID").pipe(Config.withDefault("")),
      },
    }).pipe(RemovalPolicy.retain());

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
      legacyVisitorDatabaseId: legacyVisitors.databaseId,
      cmsDatabaseId,
    };
  }),
);
