import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwind from "@tailwindcss/vite";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash, { memoryCache } from "emdash/astro";
import { fileURLToPath } from "node:url";

export default defineConfig({
  site: "https://www.liftaris.dev",
  output: "server",
  adapter: cloudflare({ imageService: "cloudflare-binding" }),
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
    "/work": { destination: "/experience", status: 307 },
    "/posts": { destination: "/", status: 307 },
    "/admin": { destination: "/_emdash/admin", status: 302 },
  },
  integrations: [react(), emdash({
    database: d1({ binding: "DB" }),
    storage: r2({ binding: "MEDIA" }),
    objectCache: memoryCache({ defaultTtl: 60 }),
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
