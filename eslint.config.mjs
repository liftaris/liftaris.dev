import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";

export default [
  { ignores: ["scripts/**", ".worktrees/**", ".astro/**", ".next/**", ".wrangler/**", ".vercel/**", ".local-backups/**", "dist/**", "out/**", "emdash-env.d.ts", "worker-configuration.d.ts"] },
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
