import { localState, RemovalPolicy, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Config, Effect, Schema } from "effect";
import type { House } from "./src/server/house/House";

// This stack owns stage sessions and references separately provisioned preview
// CMS/media. It must never own or bind production storage.
// Build with the existing Astro adapter first so EmDash's fetch/scheduled
// handlers, House export, and Vite-generated module layout stay intact.
// Retained resource declarations are not app dependencies. Removing them can
// delete remote storage; see docs/portfolio-deployment.md before an apply.
export default Stack(
  "liftaris-house-preview",
  {
    providers: Cloudflare.providers(),
    state:
      process.env.ALCHEMY_STATE === "local"
        ? localState()
        : Cloudflare.state(),
  },
  Effect.gen(function* () {
    // Construction-time inputs defaulting to provisioned preview resources.
    // Production storage IDs are strictly blocked.
    const cmsDatabaseId = yield* Config.schema(
      Schema.String.check(
        Schema.isUUID(),
        Schema.makeFilter((id) => id.toLowerCase() !== "0e886ca8-384e-4090-8035-c187268c7da7", {
          message: "Preview DB must not use production storage",
        }),
      ),
      "PREVIEW_CMS_DATABASE_ID",
    ).pipe(Config.withDefault("a5e64636-afe8-44f9-87e6-5055554edda9"));

    const mediaBucketName = yield* Config.schema(
      Schema.String.check(
        Schema.isPattern(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/),
        Schema.makeFilter((name) => name !== "liftaris-emdash-media", {
          message: "Preview MEDIA must not use production storage",
        }),
      ),
      "PREVIEW_MEDIA_BUCKET_NAME",
    ).pipe(Config.withDefault("liftaris-emdash-media-preview"));

    // Persist retain in existing stage state before any later removal. Simply
    // deleting this declaration would destroy databases with the old policy.
    const legacyVisitors = yield* Cloudflare.D1.Database("Visitors", {
      migrations: "./migrations/visitor-auth",
    }).pipe(RemovalPolicy.retain());
    const sessions = yield* Cloudflare.KV.Namespace("Sessions");

    const website = yield* Cloudflare.Worker("Website", {
      name: "liftaris-house-preview",
      main: "./dist/server/entry.mjs",
      bundle: false,
      assets: "./dist/client",
      compatibility: { date: "2026-09-22", flags: ["nodejs_compat"] },
      workersDev: true,
      routes: [],
      crons: [],
      observability: { enabled: true },
      env: {
        SESSION: sessions,
        // Alchemy beta.79 emits deletedClasses if this declaration disappears.
        // Keep it bound to the inert export unless namespace deletion is approved.
        // No application route uses HOUSE; Wrangler needs no runtime binding.
        HOUSE: Cloudflare.DurableObject<House>("House", { className: "House" }),
        EMDASH_SETUP_KEY: Config.Redacted("EMDASH_SETUP_KEY"),
        JEV_API_KEY: Config.Redacted("JEV_API_KEY"),
        HOUSE_OWNER_ID: Config.String("HOUSE_OWNER_ID").pipe(Config.withDefault("")),
      },
    }).pipe(RemovalPolicy.retain());

    // Reference the Wrangler preview CMS/media without managing their lifecycle.
    // Scheduled CMS publishing stays exclusively on the production Worker.
    yield* website.bind`preview-cms`({
      bindings: [
        { type: "d1", name: "DB", databaseId: cmsDatabaseId },
        { type: "r2_bucket", name: "MEDIA", bucketName: mediaBucketName },
      ],
    });

    return {
      url: website.url,
      workerName: website.workerName,
      legacyVisitorDatabaseId: legacyVisitors.databaseId,
      cmsDatabaseId,
      mediaBucketName,
    };
  }),
);
