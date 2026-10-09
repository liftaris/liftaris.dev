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

`bun run deploy:check` builds and checks the production database identity and
pending EmDash migrations without changing the database or deploying.
`bun run deploy` builds once, records a D1 Time Travel restore point before pending
migrations, applies and verifies migrations, deploys that same artifact, and warms
public pages after verifying the Worker version. Local runs reuse Wrangler login;
Workers Builds needs `CLOUDFLARE_API_TOKEN` with D1 and Worker deployment permissions.
Keep `.emdash/deployments/` as a CI artifact. Restore bookmarks expire after the
account's Time Travel retention window (7 days Free, 30 days Paid); restoring one
also rolls back subsequent content writes. Application rollback does not roll back
database changes.

In Workers Builds use `bun install --frozen-lockfile && bun run build` for the build
command and `bun run deploy --skip-build` for the production deployment command.
Runtime migrations remain automatic until this pipeline has been exercised on
preview and installed on every deployment path. Move to `migrations.runtime:
"check"` next; keep development automatic. Do not switch to manual prematurely.

Preview uses isolated bindings. Check with `bun run deploy:check --target preview`;
deploy with `bun run deploy --target preview --preview-name perf-pass --origin
https://YOUR-PREVIEW-HOST`. Preview warming always stays on the selected origin.
Deploying code does not migrate preview content to production.
The `House` deletion declaration retires the unused Durable Object store on
deployment. Local notes live under ignored `.ignore/` and `docs/`.

`bun run perf:measure --samples 5 --out .emdash/performance.json` records header
latency, response size, cache status, edge location and server timings for sitemap
URLs, window variants and GitHub data. Run from several regions for CDN comparisons.
`PERF_COOKIE` optionally supplies a session for private-response measurements.
`bun run perf:warm --version WORKER_VERSION_ID` warms anonymous URLs with bounded
concurrency and checks their second responses. Local runs verify headers and
rendering; only deployed runs can verify HIT/UPDATING and publication invalidation.

To move Pixel Art's embedded PNGs to managed media, log in with the CLI (or set
`EMDASH_TOKEN` to an owner token) and run `bun run media:migrate-inline --origin https://www.liftaris.dev --id
01M44KXX7JXGZHCE55YZ6C966M --directory .emdash/pixel-art-backup`. Review the backed-up
entry, revisions, PNGs and hash manifest, then repeat with `--apply`. Uploads resume
from the manifest; a changed entry or pending draft stops the write. `--rollback`
restores the original body only if the migrated entry has not changed. Retain the
backup and uploaded files until verification is complete. Use the canonical `www`
origin for `bun run cms login`; device approval remains restricted to the owner.
