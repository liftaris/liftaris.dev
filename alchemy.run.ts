import { Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Config, Effect } from "effect";
import type { House } from "./src/server/house/House";

// This stack owns an isolated preview. Production remains owned by Wrangler.
// Build with the existing Astro adapter first so EmDash's fetch/scheduled
// handlers, House export, and Vite-generated module layout stay intact.
export default Stack(
  "liftaris-house-preview",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const cms = yield* Cloudflare.D1.Database("Cms");
    const visitors = yield* Cloudflare.D1.Database("Visitors", {
      migrations: "./migrations/visitor-auth",
    });
    const media = yield* Cloudflare.R2.Bucket("Media");
    const sessions = yield* Cloudflare.KV.Namespace("Sessions");

    const website = yield* Cloudflare.Worker("Website", {
      main: "./dist/server/entry.mjs",
      bundle: false,
      assets: "./dist/client",
      compatibility: { date: "2026-09-22", flags: ["nodejs_compat"] },
      workersDev: true,
      crons: ["* * * * *"],
      observability: { enabled: true },
      env: {
        DB: cms,
        MEDIA: media,
        SESSION: sessions,
        VISITOR_DB: visitors,
        HOUSE: Cloudflare.DurableObject<House>("House", { className: "House" }),
        EMDASH_SETUP_KEY: Config.Redacted("EMDASH_SETUP_KEY"),
        VISITOR_AUTH_SECRET: Config.Redacted("VISITOR_AUTH_SECRET"),
        JEV_API_KEY: Config.Redacted("JEV_API_KEY"),
        HOUSE_OWNER_ID: Config.String("HOUSE_OWNER_ID").pipe(Config.withDefault("")),
      },
    });

    return {
      url: website.url,
      workerName: website.workerName,
      visitorDatabaseId: visitors.databaseId,
      cmsDatabaseId: cms.databaseId,
    };
  }),
);
