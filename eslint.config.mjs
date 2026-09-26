import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";

export default [
  { ignores: ["scripts/**", ".astro/**", ".next/**", ".wrangler/**", ".vercel/**", "dist/**", "out/**", "emdash-env.d.ts", "worker-configuration.d.ts"] },
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
];
