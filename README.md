# liftaris.dev

Astro, React, and EmDash on Cloudflare Workers. Content lives in D1, media in R2,
and sessions in KV. Edit Things and Posts in `/_emdash/admin`.

```sh
bun install --frozen-lockfile
bun run dev
```

Worker declarations are generated before development, build, and type checking.

Use `.dev.vars` for local `EMDASH_SETUP_KEY` and `HOUSE_OWNER_ID`. Native EmDash
Dev bypass is available locally. Hosted administration requires the configured
owner's passkey.

`seed/seed.json` defines models for a fresh CMS; it contains no sample content.
Existing CMS models and content are managed in EmDash, not reapplied on deploy.
Apply `migrations/guestbook/0001_receipts.sql` explicitly to the intended D1 after
EmDash initialization; the guestbook needs its atomic retry receipt trigger.

```sh
bun run lint
bun run typecheck
bun run knip
bun run build
```

`bun run emoji:generate` rebuilds the 255-icon catalog from Emojibase using
Unicode IDs. `things-preview/[id]` is the signed CMS preview route.

Wrangler owns deployments. `interactive-stuff` uses isolated preview bindings;
merging `main` deploys production through Workers Builds. `bun run deploy` also
targets production. Deploying code does not migrate preview content to production.
The `House` deletion declaration retires the unused Durable Object store on
deployment. Local notes live under ignored `.ignore/`.
