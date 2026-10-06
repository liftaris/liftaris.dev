import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import react from "@astrojs/react";
import tailwind from "@tailwindcss/vite";
import { d1, r2, kvCache } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { fileURLToPath } from "node:url";

export default defineConfig({
  site: "https://www.liftaris.dev",
  output: "server",
  adapter: cloudflare({ imageService: "cloudflare-binding" }),
  cache: {
    provider: cacheCloudflare(),
  },
  routeRules: {
    "/": { maxAge: 300, swr: 86400 },
  },
  image: {
    remotePatterns: [
      { protocol: "https", pathname: "/_emdash/api/media/file/**" },
      { protocol: "http", pathname: "/_emdash/api/media/file/**" },
    ],
  },
  build: {
    inlineStylesheets: "always",
  },
  compressHTML: true,
  prefetch: {
    prefetchAll: false,
    defaultStrategy: "hover",
  },
  session: {
    // Astro forces HttpOnly and defaults Secure to true in production. Keep the
    // native owner cookie browser-scoped; only visitor bootstrap adds Max-Age
    // and a per-key TTL, so visiting the house never extends an admin session.
    cookie: { name: "astro-session", path: "/", sameSite: "lax" },
  },
  redirects: {
    "/admin": { destination: "/_emdash/admin", status: 302 },
  },
  integrations: [react(), emdash({
    siteUrl: "https://www.liftaris.dev",
    database: d1({ binding: "DB", session: "auto" }),
    storage: r2({ binding: "MEDIA" }),
    objectCache: kvCache({ binding: "CONTENT_CACHE", defaultTtl: 3600 }),
    toolbar: "client",
    plugins: [{
      id: "liftaris-things", version: "1.0.0", format: "native",
      entrypoint: fileURLToPath(new URL("./src/plugins/things.ts", import.meta.url)),
      adminEntry: "/src/plugins/things/admin.tsx",
    }, {
      id: "liftaris-theme-image",
      version: "1.0.0",
      format: "native",
      entrypoint: fileURLToPath(new URL("./src/plugins/theme-image.ts", import.meta.url)),
      componentsEntry: "/src/plugins/theme-image-components.ts",
    }, {
      id: "liftaris-gifts",
      version: "1.0.0",
      format: "native",
      entrypoint: fileURLToPath(new URL("./src/plugins/gifts.ts", import.meta.url)),
    }],
  })],
  vite: {
    plugins: [tailwind()],
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  },
  devToolbar: { enabled: false },
});
