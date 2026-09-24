# Shared house: local development and deployment

The app keeps Astro 7, `@astrojs/cloudflare` 14, and EmDash 0.38. `src/worker.ts` retains the EmDash request handler and scheduled publishing handler, and exports the SQLite-backed `House` Durable Object. API routes and the House class run in the same Worker. The current adapter's Cloudflare Vite integration supports that export in local development; no companion Worker is required.

## Resource ownership

| Target | Configuration owner | Resources |
| --- | --- | --- |
| Existing production portfolio | `wrangler.jsonc` / Wrangler | Existing `liftaris-dev` Worker, CMS `DB`, `MEDIA`, `SESSION`, custom domains, and publishing cron |
| Local development | Astro / Wrangler local simulator | Separate local `VISITOR_DB`, local House SQLite storage, and local CMS bindings |
| GitHub branch previews | `wrangler.jsonc` `previews` / Workers Builds | Shared production CMS D1 and media R2; separate preview visitor D1, session KV, and automatic per-branch House namespace |
| Optional standalone Alchemy preview | `alchemy.run.ts` / Alchemy | Shared production CMS D1 and media R2 bindings; a new Worker, visitor D1, session KV, and House namespace for each stage |

Preview and production intentionally use one EmDash CMS database and media library. Alchemy references those existing resources with raw Worker bindings; it does not adopt, create, migrate, or delete them as managed stack resources, copy their contents, or attach `liftaris.dev` routes. Its output includes the preview URL, Worker name, and database IDs. EmDash's D1 adapter manages its CMS schema, so preview CMS versions must remain compatible with the shared database. House gifts live only in the Durable Object, while anonymous visitor identities and sessions live only in `VISITOR_DB`. PartySync shares additions and withdrawals; positions and physics remain local to each page and reset on reload.

`VISITOR_DB.database_id` in `wrangler.jsonc` is the deliberately invalid-for-production local sentinel `00000000-0000-0000-0000-000000000001`. Local commands can use it. Provision and configure a real, separate production visitor database before deploying the existing Wrangler target. Do not point visitor auth at the CMS `DB`.

## Local setup

Install the pinned dependencies with `bun install`. Alchemy 2.0.0-beta.79 uses Effect 4.0.0-rc.117 and requires the matching `@effect/platform-bun` CLI peer and `@effect/platform-node` Worker tooling peer.

Keep local values in the ignored `.dev.vars` file:

```dotenv
EMDASH_SETUP_KEY=<your existing local CMS setup key>
VISITOR_AUTH_SECRET=<a stable random secret of at least 32 characters>
JEV_API_KEY=<your TypeSafe API key>
```

`HOUSE_OWNER_ID` is optional and defaults to empty. Set it to the exact EmDash user ID allowed to moderate gifts. An empty value disables owner privileges; it does not grant them to every CMS user. This does not change visitor identity or visitor gift ownership. Keep `VISITOR_AUTH_SECRET` stable across restarts and deployments so existing sessions can still be verified. Never use a `PUBLIC_` prefix for these values.

Apply the visitor schema to the local database, regenerate binding types, and start the app:

```sh
bunx wrangler d1 migrations apply VISITOR_DB --local
bunx wrangler types --strict-vars false
bun run dev
```

The checked-in visitor migrations are in `migrations/visitor-auth`. Local emulator storage is under ignored `.wrangler/`; deleting that directory also deletes local visitors and gifts. Use `--local` explicitly for local migration commands. There are no remote bindings in the development configuration.

The House namespace migration is the `house-v1` entry with `new_sqlite_classes: ["House"]`. The Durable Object initializes its application tables itself. Its class migration and D1 visitor migrations serve separate purposes; D1 commands do not initialize House storage.

Visitor identity is a Better Auth bearer token stored in localStorage. The stored session lasts 100 years and is renewed near expiry; database hooks preserve that lifetime while the library's temporary, discarded cookies stay within its 400-day serializer limit. No visitor cookies are sent to the browser. Clearing localStorage or using another origin/browser profile creates a new visitor, without recovery of older gifts.

## Build and validate without deployment

```sh
bun run typecheck
bun run build
node scripts/verify-house-worker.mjs
```

The build must export `House` from `dist/server/entry.mjs`, retain the default `fetch` and `scheduled` handlers, and emit the `HOUSE` / `VISITOR_DB` bindings in `dist/server/wrangler.json`. The Astro build may open local helper servers. It does not deploy the Worker.

For a strictly local production-build smoke test with the existing custom-domain routes, use an explicit local upstream, so the site's canonical-host redirect does not send requests to production:

```sh
bunx wrangler dev --local --port 8787 --local-upstream 127.0.0.1:8787 --upstream-protocol http
```

Stop the Astro development server while testing the built Worker against the same local storage. Restart the local Wrangler process after rebuilding `dist/`: its asset index can otherwise retain deleted files and return 404s despite a successful Worker reload. Restart Astro after build/typecheck commands, which may invalidate its Vite dependency cache.

Run the repeatable two-browser lifecycle checks against an initialized, disposable local server:

```sh
bunx agent-browser@0.38.1 install
bun scripts/verify-house-browser.ts http://127.0.0.1:8787
```

The script refuses non-loopback hosts, uses isolated browser sessions, creates local test visitors/gifts, and reclaims its test gifts on exit. It covers inspected and held gifts surviving remote deletion, departure/focus cleanup, additions during a grab, missed deletions on reconnect, a half-open socket after foreground return, and already-loaded private cards. Use disposable local storage, not production bindings.

## GitHub branch previews

Workers Builds deploys non-production branches with `wrangler preview`. This uses the explicit `previews` block in `wrangler.jsonc`, not the top-level production bindings and not the Alchemy stack. Astro otherwise injects a `SESSION` preview binding without a namespace ID, which Cloudflare rejects during deployment.

The preview `DB` binding uses the existing `liftaris-emdash` database, and `MEDIA` uses `liftaris-emdash-media`, exactly as production does. Existing posts, media, and CMS users are available without another setup wizard or seed import. CMS edits, uploads, deletions, and schema migrations affect the shared live CMS; preview is not a sandbox for destructive CMS testing. Use the production CMS admin origin for existing passkeys, whose credentials are origin-bound.

Runtime sessions use `liftaris-preview-sessions` and visitor identities use `liftaris-preview-visitors`, separate from production and from the CMS. Branches using the same IDs share those preview resources; House Durable Object storage is isolated automatically per branch.

`bun run build` validates the emitted `dist/server/wrangler.json` for complete preview bindings, shared production CMS/media storage, isolated visitor/session storage, and alignment with the visitor migration target. Before deploying visitor schema changes, run:

```sh
bun run db:visitor:preview
```

This uses `wrangler.preview-migrations.json`, whose visitor database ID must match `previews.d1_databases`. Wrangler's D1 migration commands do not select the new `previews` block. Do not use the top-level production/local visitor binding or substitute the CMS database.

Set `EMDASH_SETUP_KEY`, `VISITOR_AUTH_SECRET`, and `JEV_API_KEY` as secrets in the **Previews Base** configuration. Use distinct preview setup/auth secrets and keep the visitor secret stable. Secret values do not belong in Git or plaintext `vars`. Bootstrap each new branch Preview once with a private JSON or dotenv file containing only these keys:

```sh
bunx wrangler preview base-config secret bulk /path/to/private-preview-secrets.json
bun run build
bunx wrangler preview --name interactive-stuff --secrets-file /path/to/private-preview-secrets.json
```

Base secrets are copied when a Preview is created, not when the Base changes. The explicit secrets file initializes an existing Preview too, including one created by a previously failed build. Wrangler 4.135 preview uploads replace the deployment environment: neither top-level `secrets.required` nor an earlier secret upload preserves omitted bindings. The `previews.unsafe.bindings` entries explicitly inherit these three server-side secrets without putting values in Git or CI. The build validator requires those entries. Subsequent branch pushes can then deploy through Workers Builds without a secrets file. Verify the names after deployment with `wrangler preview secret list --name interactive-stuff`; a green build alone does not prove secrets survived.

The first deployment must include `--secrets-file`: with Wrangler 4.135, a brand-new Preview has no version from which to inherit, even after Base secrets are configured, and otherwise fails with code 10222. Once bootstrapped, ordinary pushes need no secret values in the build environment.

Production routes and Cron Triggers do not run against branch previews. Leave them at the top level; scheduled CMS publishing runs only on production, not again on a preview. Never use `bun run deploy` to repair a preview. The published preview URL is shown by Wrangler and the Cloudflare dashboard.

## Optional standalone Alchemy preview

Alchemy's own Astro integration installs a different adapter and rejects the existing adapter. This stack instead consumes the already-built Astro output with `Cloudflare.Worker({ main, bundle: false, assets })`. It uploads the emitted module tree unchanged, preserves the custom Worker entrypoint, and uses `dist/client` for static assets. Always build immediately before a plan or deployment.

The stack uses `Config.Redacted` for the CMS setup key, visitor secret, and Jev API key. Provide preview values through the shell environment or a private ignored environment file. Alchemy reads `.env` by default; use `--env-file .dev.vars` only when deliberately reusing local credentials for a private test preview. Prefer distinct secrets for hosted environments.

Once cloud provisioning is intended and Cloudflare credentials are configured:

```sh
bun run build
bunx alchemy plan --stage preview
bunx alchemy deploy --stage preview
```

**The first Alchemy plan is not necessarily read-only.** This stack uses `Cloudflare.state()`, which can provision the account's Alchemy state-store Worker, Durable Object, and Secrets Store before planning application resources. Review that bootstrap and the application plan before accepting cloud changes. No Alchemy plan, cloud bootstrap, or deployment was performed while implementing this integration.

Alchemy owns migration application for its preview `Visitors` resource through `migrations: "./migrations/visitor-auth"`. It records applied files in its own migration table. Do not also run Wrangler remote migration commands against that Alchemy-owned preview database. Use one migration owner per remote database.

## Existing production target

The existing `bun run deploy` path still targets the Wrangler-owned production Worker. The added visitor database sentinel must be replaced first, visitor migrations must be applied to that new production database, and `VISITOR_AUTH_SECRET` / `JEV_API_KEY` must be configured as Worker secrets. Set `HOUSE_OWNER_ID` explicitly when moderation is wanted. Preserve the existing CMS database ID, R2 bucket, KV namespace, custom domains, and cron.

The Alchemy preview is not a production migration. Promoting its visitor or House infrastructure requires a separate decision about resource ownership. The CMS and media bindings already reference production and must remain unmanaged by the preview stack. Do not use `--adopt`, rename preview resources to production names, or copy preview visitor IDs into production config as a shortcut.

## References

- [Alchemy state and first-run bootstrap](https://alchemy.run/state-store/)
- [Alchemy Worker source](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/Workers/Worker.ts), verified against the installed beta.79 `WorkerProps` / `bundle: false` implementation
- [Astro Cloudflare integration](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare Durable Object class migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
