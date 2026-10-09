# liftaris.dev

Astro, React, and EmDash on Cloudflare Workers. Content lives in D1, media in R2,
and sessions in KV. Edit Things and Posts in `/_emdash/admin`.

Use Bun 1.4.2 (also pinned in `package.json`). Set the Workers Builds environment
variable `BUN_VERSION=1.4.2` so hosted installs use the same version.

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

Cloudflare Workers Builds handles deployment through the connected Git repository.
Use these commands in the integration settings:

- Build: `bun run build` (Workers Builds installs dependencies before this step).
- Production deploy: `bunx wrangler deploy`.
- Preview deploy: `bunx wrangler preview`.

Wrangler uses the Astro-generated configuration in `dist/server/wrangler.json`.
For a manual production deployment, `bun run deploy` builds and runs Wrangler.
EmDash runtime migrations remain automatic. Deployment does not run a separate
migration or cache-warming script; the performance tools below are optional.

Previews use isolated database, media, and session bindings. Deploying code does
not migrate preview content to production. Set `EMDASH_SETUP_KEY` in Previews Base
using `bunx wrangler preview base-config secret put EMDASH_SETUP_KEY` before creating
previews. Do not add an explicit `type: "inherit"` secret binding or pass
`--ignore-base-config`: inheritance requires an existing deployment and fails with
error 10222 on the first upload. Wrangler preserves existing Preview secrets on
subsequent deployments. Base secret changes apply only to new previews; use
`bunx wrangler preview secret put EMDASH_SETUP_KEY --name PREVIEW_NAME` to update
an existing deployed preview.

The `House` deletion declaration retires the unused Durable Object store on
deployment. Local notes live under ignored `.ignore/` and `docs/`.

`bun run perf:measure --samples 5 --out .emdash/performance.json` records header
latency, response size, cache status, edge location and server timings for sitemap
URLs, window variants and GitHub data. Run from several regions for CDN comparisons.
`PERF_COOKIE` optionally supplies a session for private-response measurements.
`bun run perf:warm --version WORKER_VERSION_ID` warms anonymous URLs with bounded
concurrency and checks their second responses. Local runs verify headers and
rendering; only deployed runs can verify HIT/UPDATING and publication invalidation.

Public pages (including desktop window URLs) and the sitemap stay fresh at the
edge for one day, then allow seven days of stale-while-revalidate. Browsers use
one hour of freshness plus one day of SWR, avoiding a blocking network request
on every window reopen. EmDash invalidates the collection/settings tags on CMS
changes; the Cloudflare adapter purges those edge entries. Browser copies cannot
be purged, so returning visitors can briefly see older content after an edit.
Purges, new deployments, eviction, and expired stale windows can still cause a
blocking first render. GitHub/npm project counters remain server-rendered with
their existing 12-hour data cache; page SWR covers their background refresh.
Private and preview responses remain uncached. GitHub contributions use a
separate one-hour policy with one day of SWR (60 seconds without SWR on fallback).

To move Pixel Art's embedded PNGs to managed media, log in with the CLI (or set
`EMDASH_TOKEN` to an owner token) and run `bun run media:migrate-inline --origin https://www.liftaris.dev --id
01M44KXX7JXGZHCE55YZ6C966M --directory .emdash/pixel-art-backup`. Review the backed-up
entry, revisions, PNGs and hash manifest, then repeat with `--apply`. Uploads resume
from the manifest; a changed entry or pending draft stops the write. `--rollback`
restores the original body only if the migrated entry has not changed. Retain the
backup and uploaded files until verification is complete. Use the canonical `www`
origin for `bun run cms login`; device approval remains restricted to the owner.
