import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig(({ isPreview }) => ({
  worker: {
    name: "liftaris-dev",
    compatibilityDate: "2026-09-22",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint: "./src/worker.ts",
    workersDev: true,
    placement: { mode: "smart" },
    observability: { enabled: true },
    domains: isPreview ? [] : ["liftaris.dev", "www.liftaris.dev"],
    // Preview uploads do not support scheduled triggers.
    ...(!isPreview && {
      triggers: [triggers.scheduled({ schedule: "* * * * *" })],
    }),
    env: {
      HOUSE_OWNER_ID: bindings.text(isPreview
        ? "01M3D50BEQJSREDCCRJK91R999"
        : "01M366VZ20X87M0WMW2Y846Z0Y"),
      // Hosted previews receive this secret from Previews Base.
      EMDASH_SETUP_KEY: bindings.secret(),
      DB: bindings.d1(isPreview ? {
        name: "liftaris-things-authoring-preview",
        id: "6bf414ef-c86a-4674-b7ab-e0dac70f7bf6",
      } : {
        name: "liftaris-emdash",
        id: "0e886ca8-384e-4090-8035-c187268c7da7",
      }),
      SESSION: bindings.kv({ id: isPreview
        ? "d40889cd503f4bd4912c6de7aafd5394"
        : "8bf01aa04a0d44499c86e377038ad892" }),
      CONTENT_CACHE: bindings.kv({ id: isPreview
        ? "25ddbbafcde5465b9dad36fd1661f712"
        : "09450dee8cee45a6b247e7c9f30c128b" }),
      MEDIA: bindings.r2({ name: isPreview
        ? "liftaris-things-authoring-media"
        : "liftaris-emdash-media" }),
      AI: bindings.ai({}),
      IMAGES: bindings.images({}),
      CF_VERSION_METADATA: bindings.versionMetadata(),
    },
  },
}));
