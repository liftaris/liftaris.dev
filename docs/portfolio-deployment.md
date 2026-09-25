# Native CMS accounts and gifts: deployment

The app uses Astro, React, EmDash, and one Cloudflare Worker. Native EmDash users
and CMS gift records use the existing `DB`; gift reads and mutations use HTTP.
There is no Better Auth runtime, visitor database binding, WebSocket channel,
background gift synchronization, or companion Worker. `src/worker.ts` preserves
EmDash's request and scheduled handlers. Its inert `House` export exists only to
preserve a historical namespace, not to serve the application.

**Native CMS gifts start fresh.** Kaio confirmed that local gifts are development
tests, preview has no gifts, and production has not shipped this system. No
legacy migration is needed. Existing stores remain untouched; the
[retirement safeguards](legacy-gift-retirement.md) still apply to resource deletion.

## Resource ownership

| Target | Configuration owner | Resources |
| --- | --- | --- |
| Existing production portfolio | `wrangler.jsonc` / Wrangler | Existing `liftaris-dev` Worker, CMS `DB`, `MEDIA`, `SESSION`, custom domains, and publishing cron |
| Local development | Astro / Wrangler local simulator | Local CMS `DB`, `MEDIA`, and `SESSION` |
| GitHub branch previews | `wrangler.jsonc` `previews` / Workers Builds | Shared production CMS D1 and media R2; separate preview session KV |
| Existing standalone Alchemy stages | `alchemy.run.ts` / Alchemy | Shared CMS/media references, stage Worker and session KV, plus temporary legacy preservation declarations |

Preview and production intentionally share **posts, media, native visitor users,
and gifts** in one CMS. An account/session is not portable between origins merely
because the database is shared. The `SESSION` KV binding remains separate for
production and preview; branches using the same preview ID share that preview KV.
Astro/EmDash native cookie sessions use that KV, not a separate visitor auth
service. Keep preview CMS versions compatible with the shared schema.

The app needs `DB`, `MEDIA`, `SESSION`, `JEV_API_KEY`, and `HOUSE_OWNER_ID`, plus
`EMDASH_SETUP_KEY` to protect initial setup. The former production visitor sentinel
has been removed. Do not provision a replacement visitor database or apply the
archived visitor-auth schema to `DB`.

## Local setup

Install the pinned dependencies with `bun install --frozen-lockfile`.

Keep local values in the ignored `.dev.vars` file:

```dotenv
EMDASH_SETUP_KEY=<your existing local CMS setup key>
JEV_API_KEY=<your TypeSafe API key>
HOUSE_OWNER_ID=<your native EmDash administrator user ID>
```

`HOUSE_OWNER_ID` must be configured for CMS administration after setup. Set it to
the exact native EmDash administrator ID allowed to moderate gifts and read private
messages. Empty fails closed, including CMS administration; it does not trust every
CMS user. After first-admin setup or native login, `/_emdash/api/auth/me` remains
readable and provides that account's ID. Never use a `PUBLIC_` prefix for server secrets.

Regenerate binding types and start the app:

```sh
bunx wrangler types --strict-vars false
bun run dev
```

Use EmDash's local dev bypass to initialize a fresh local CMS and administrator.
Automatic visitor creation must not replace or bypass first-admin setup. On hosted
targets that setup stays protected by `EMDASH_SETUP_KEY`; keep its handoff link
private. There are no remote bindings in the development configuration. Local
emulator data lives under ignored `.wrangler/`; do not erase it to fix migrations.

EmDash manages its CMS schema. There is no separate visitor migration step.
`migrations/visitor-auth` is immutable legacy history, not the current schema.
Wrangler retains `house-v1` and the inert `House` export to avoid destroying old
gift storage, but neither production nor preview binds `HOUSE` to the application.

Automatic anonymous accounts use native EmDash sessions with HttpOnly cookies.
Cookie expiry, clearing site data, or changing origin/profile can lose ownership
access; there is no 100-year bearer lifetime or automatic legacy-token recovery.
Existing CMS sessions must not be overwritten by visitor initialization.

## Build and validate without deployment

```sh
bun run typecheck
bun run build
node scripts/verify-preview-config.mjs
```

`bun run build` runs the preview verifier automatically; the separate command can
recheck an existing build. It validates `dist/server/wrangler.json`: shared CMS
and media, isolated session KV, inherited server secrets, no `VISITOR_DB` or
`HOUSE` runtime bindings, and preserved non-destructive class history. The Worker
must still export the inert `House` and retain `fetch` / `scheduled`. The Astro
build may open local helper servers; it does not deploy the Worker.

For a strictly local production-build smoke test with the existing custom-domain routes, use an explicit local upstream, so the site's canonical-host redirect does not send requests to production:

```sh
bunx wrangler dev --local --port 8787 --local-upstream 127.0.0.1:8787 --upstream-protocol http
```

Stop the Astro development server while testing the built Worker against the same local storage. Restart the local Wrangler process after rebuilding `dist/`: its asset index can otherwise retain deleted files and return 404s despite a successful Worker reload. Restart Astro after build/typecheck commands, which may invalidate its Vite dependency cache.

Use disposable local storage for account and gift tests. Verify two independent
native sessions, reload persistence, unauthorized reclaim/private-message denial,
exact owner authorization, and public-response redaction. HTTP-only behavior must
not depend on socket reconnection, timers, or cross-browser pushes. Do not run
mutation tests against shared preview/production CMS bindings.

## GitHub branch previews

Workers Builds deploys non-production branches with `wrangler preview`. This uses the explicit `previews` block in `wrangler.jsonc`, not the top-level production bindings and not the Alchemy stack. Astro otherwise injects a `SESSION` preview binding without a namespace ID, which Cloudflare rejects during deployment.

The preview `DB` binding uses `liftaris-emdash`, and `MEDIA` uses
`liftaris-emdash-media`, exactly as production does. No second setup wizard or seed
import is needed. **Preview gift creation/removal and automatic account creation
now also write to the shared live CMS**, alongside edits, uploads, and schema
migrations. Preview is not a sandbox. Use the production CMS admin origin for
existing passkeys, whose credentials are origin-bound.

The only environment-specific storage binding needed by the preview runtime is
its `SESSION` KV. The old preview visitor database is unbound, not deleted. Old
House namespaces and test identities remain untouched, not imported into the CMS.

Set `EMDASH_SETUP_KEY` and `JEV_API_KEY` in the **Previews Base** configuration.
Use a distinct preview setup key. Values do not belong in Git or plaintext `vars`.
For an authorized deployment, bootstrap each new Preview with a
private JSON or dotenv file containing only those two keys:

```sh
bunx wrangler preview base-config secret bulk /path/to/private-preview-secrets.json
bun run build
bunx wrangler preview --name interactive-stuff --secrets-file /path/to/private-preview-secrets.json
```

Base secrets are copied when a Preview is created, not when the Base changes.
The explicit secrets file initializes an existing Preview too, including one
created by a failed build. Wrangler 4.135 preview uploads replace the deployment
environment: neither top-level `secrets.required` nor an earlier secret upload
preserves omitted bindings. `previews.unsafe.bindings` explicitly inherits these
two server-side secrets without putting values in Git or CI, and the verifier
requires both. Subsequent pushes can deploy without a secrets file. Verify names
after an authorized deployment with
`wrangler preview secret list --name interactive-stuff`; a green build alone does
not prove secrets survived.

The first deployment must include `--secrets-file`: with Wrangler 4.135, a brand-new Preview has no version from which to inherit, even after Base secrets are configured, and otherwise fails with code 10222. Once bootstrapped, ordinary pushes need no secret values in the build environment.

Production routes and Cron Triggers do not run against branch previews. Leave them at the top level; scheduled CMS publishing runs only on production, not again on a preview. Never use `bun run deploy` to repair a preview. The published preview URL is shown by Wrangler and the Cloudflare dashboard.

## Existing standalone Alchemy previews

Alchemy consumes the current adapter's prebuilt Worker using
`Cloudflare.Worker({ main, bundle: false, assets })`. It preserves the emitted
module tree, `dist/client`, and custom entrypoint rather than installing another
Astro adapter. Raw `DB` and `MEDIA` bindings reference shared production resources
without adopting or managing their lifecycle. Only production runs the CMS cron.

The stack needs only the setup and Jev secrets (`Config.Redacted`), the configured
owner ID, and stage sessions for the application. It still declares legacy
`Visitors` with `RemovalPolicy.retain()` and an unused `HOUSE` binding as a
**data-preservation hold**. Alchemy otherwise emits a destructive class migration
when the binding is removed. These are not a second active auth or gift backend.
The Worker is also marked for retention, but that does not prevent class deletion
during an in-place update. See the [staged retirement procedure](legacy-gift-retirement.md).

Do not provision fresh stages from this transitional stack or run it as a static
check. **A first Alchemy plan can write cloud state** via `Cloudflare.state()`
bootstrap. Retain policies need an explicitly approved apply and readback before
declarations can be orphaned safely. No plan, bootstrap, or deployment has been
performed for this change. Do not run Wrangler migrations against Alchemy-owned
legacy databases; their unchanged migration history still belongs to Alchemy.

## Existing production target

`bun run deploy` targets the Wrangler-owned production Worker, not a preview.
Keep `EMDASH_SETUP_KEY` and `JEV_API_KEY` configured as Worker secrets. Set the
exact `HOUSE_OWNER_ID` for CMS administration and moderation. The production and
preview Wrangler configurations identify Kaio's verified native administrator.
Preserve the existing CMS ID,
R2 bucket, KV namespace, custom domains, cron, historical `house-v1` migration,
and inert class export. Do not add `deleted_classes` or erase old resources.

No legacy-data migration is required for this fresh-start rollout. Passing local
checks does not authorize a cloud write or resource deletion. Do not use `--adopt`,
rename preview resources to production names, or copy old visitor IDs into `DB`.

## References

- [Alchemy state and first-run bootstrap](https://alchemy.run/state-store/)
- [Alchemy Worker source](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/Workers/Worker.ts), verified against the installed beta.79 `WorkerProps` / `bundle: false` implementation
- [Astro Cloudflare integration](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare Durable Object class migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
