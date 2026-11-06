# liftaris.dev

Astro, React, and EmDash on Cloudflare Workers. Content lives in D1, media in R2,
and sessions in KV. Edit Things and Posts in `/_emdash/admin`.

Use Bun 1.4.2 (also pinned in `package.json`). Set the Workers Builds environment
variable `BUN_VERSION=1.4.2` so hosted installs use the same version.

```sh
bun install --frozen-lockfile
bun run dev
```

This project uses the beta Cloudflare CLI (`cf`), Astro 7.4 beta, and the
Cloudflare adapter 15 beta. `cloudflare.config.ts` is the source of truth for
bindings, domains, scheduled triggers, and preview resources. Worker declarations
are generated in `.cloudflare/types/` before development, build, and type checking.
Local D1, R2, and KV data continues to use `.wrangler/state/`.

Use `bun run preview` to build and serve locally. `bun run start` serves the last
build. Build output for deployment lives in `.cloudflare/output/v0/`.
Run `cf auth login` once before using authenticated CLI commands.

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
- Production deploy: `bunx cf deploy --prebuilt --mode production`.
- Preview deploy: `bunx cf previews deploy` (builds with preview-specific bindings).

Update both deployment commands in the Workers Builds integration when adopting
this migration. The production command reuses the output from the build step;
previews rebuild with `isPreview: true` so production resources are never selected.
For a manual production deployment, `bun run deploy` builds and deploys with `cf`.
Validate production uploads without publishing with
`bunx cf deploy --prebuilt --mode production --dry-run` after a build.
EmDash runtime migrations remain automatic. Deployment does not run a separate
migration or cache-warming script; the performance tools below are optional.

Previews use isolated database, media, and session bindings, and no production
custom domains or scheduled triggers. Deploying code does not migrate preview content to production.
`EMDASH_SETUP_KEY` must already be set in Previews Base before creating previews.
Existing Preview secrets remain in Cloudflare; the local configuration declares
the required secret without copying its value. Retain `wrangler.jsonc` during the
transition for existing Workers Builds commands and Preview secret management.
It is a legacy snapshot: `cf` reads only `cloudflare.config.ts`. Remove it after
the first successful `cf` deployment and the hosted integration has switched.

The retired `House` Durable Object has no remaining namespace, so its deletion
tombstone has been removed from the cf configuration. Local notes live under
ignored `.ignore/` and `docs/`.

`bun run perf:measure --samples 5 --out .emdash/performance.json` records header
latency, response size, cache status, edge location and server timings for sitemap
URLs, window variants and GitHub data. Run from several regions for CDN comparisons.
`PERF_COOKIE` optionally supplies a session for private-response measurements.
`bun run perf:warm --version WORKER_VERSION_ID` warms anonymous URLs with bounded
concurrency and checks their second responses. Local runs verify headers and
rendering; only deployed runs can verify HIT/UPDATING and publication invalidation.

Public pages, desktop window URLs, and the sitemap cache at the edge for seven
days. Browsers revalidate HTML so CMS invalidation can reach returning visitors.
EmDash invalidates collection and settings tags on writes. Media writes and
additional CMS mutation routes invalidate the site's media-reference tag.
Seven days also bounds stale pages if a purge fails or hits Cloudflare's rate limit.
The Projects page and its GitHub/npm data use twelve-hour caches. GitHub
contributions retain their separate one-hour policy with one day of SWR,
or 60 seconds without SWR on fallback. Private and preview responses stay uncached.

CMS images use `/_media/<etag>/<key>` URLs with one-year immutable caching.
`src/server/media.ts` retains each published image version under
`.liftaris-versions/` in R2 before emitting its URL. Replacement creates a new
URL; already-open pages can still load the old bytes and resized variants.
These retained copies survive deletion of the CMS original and have no automatic
cleanup. Unversioned CMS URLs keep EmDash's mutable-image policy.

The cache policy follows [EmDash's route-caching guidance](https://docs.emdashcms.com/deployment/route-caching/).
Version retention and media invalidation fill gaps in EmDash's built-in behavior.
Purges, deployments, eviction, and new cookie variants can still require a cold
render. Window-document prefetch and eager desktop artwork reduce click-time loading.

To move Pixel Art's embedded PNGs to managed media, log in with the CLI (or set
`EMDASH_TOKEN` to an owner token) and run `bun run media:migrate-inline --origin https://www.liftaris.dev --id
01M44KXX7JXGZHCE55YZ6C966M --directory .emdash/pixel-art-backup`. Review the backed-up
entry, revisions, PNGs and hash manifest, then repeat with `--apply`. Uploads resume
from the manifest; a changed entry or pending draft stops the write. `--rollback`
restores the original body only if the migrated entry has not changed. Retain the
backup and uploaded files until verification is complete. Use the canonical `www`
origin for `bun run cms login`; device approval remains restricted to the owner.
