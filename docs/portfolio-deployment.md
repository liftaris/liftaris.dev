# Native CMS accounts and gifts: deployment

The app uses Astro, React, EmDash, and one Cloudflare Worker. Native EmDash users
and CMS gift records use the existing `DB`; gift reads and mutations use HTTP.
There is no Better Auth runtime, visitor database binding, WebSocket channel,
background gift synchronization, or companion Worker. `src/worker.ts` preserves
EmDash's request and scheduled handlers. Its inert `House` export exists only to
preserve a historical namespace, not to serve the application.

## Resource ownership

| Target | Configuration owner | Resources |
| --- | --- | --- |
| Existing production portfolio | `wrangler.jsonc` / Wrangler | Existing `liftaris-dev` Worker, CMS `DB`, `MEDIA`, `SESSION`, custom domains, and publishing cron |
| Local development | Astro / Wrangler local simulator | Local CMS `DB`, `MEDIA`, and `SESSION` |
| GitHub branch previews | `wrangler.jsonc` `previews` / Workers Builds | Preview-only CMS D1, media R2, and session KV; all separate from production |
| Existing standalone Alchemy stages | `alchemy.run.ts` / Alchemy | References to the provisioned preview CMS/media, stage Worker and session KV, plus temporary legacy preservation declarations |

Preview and production do not share **posts, media, native users, gifts, or
sessions**. Branches using the same `previews` resource IDs share the preview
stores with each other, not with production; this is an environment split, not
per-branch database provisioning. Astro/EmDash native cookie sessions use each
target's `SESSION` KV, not a separate visitor auth service. Production's existing
resources, content, routes, and publishing cron remain unchanged.

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
```

`bun run build` compiles the Worker; it does not deploy. Before deploying a
preview, inspect `dist/server/wrangler.json`: D1, R2, and session KV must be
separate from production, and the setup/Jev secrets must be inherited. Keep
`fetch` / `scheduled`, the inert `House` export, and applied class history.
`scripts/` contains optional local tooling and is not part of the tracked build.

For a strictly local production-build smoke test with the existing custom-domain routes, use an explicit local upstream, so the site's canonical-host redirect does not send requests to production:

```sh
bunx wrangler dev --local --port 8787 --local-upstream 127.0.0.1:8787 --upstream-protocol http
```

Stop the Astro development server while testing the built Worker against the same local storage. Restart the local Wrangler process after rebuilding `dist/`: its asset index can otherwise retain deleted files and return 404s despite a successful Worker reload. Restart Astro after build/typecheck commands, which may invalidate its Vite dependency cache.

Use disposable local storage for account and gift tests. Verify two independent
native sessions, reload persistence, unauthorized reclaim/private-message denial,
exact owner authorization, and public-response redaction. HTTP-only behavior must
not depend on socket reconnection, timers, or cross-browser pushes. Do not run
mutation tests against production CMS bindings. Hosted preview tests require
explicit authorization and verified preview-only resource IDs.

## GitHub branch previews

Workers Builds deploys non-production branches with `wrangler preview`. This uses the explicit `previews` block in `wrangler.jsonc`, not the top-level production bindings and not the Alchemy stack. Astro otherwise injects a `SESSION` preview binding without a namespace ID, which Cloudflare rejects during deployment.

Every storage binding in `previews` must identify a provisioned non-production
resource: `DB.database_id`, `MEDIA.bucket_name`, and `SESSION.id`. Use these
explicit identifiers rather than automatic provisioning or production fallback.
The source of truth is `wrangler.jsonc`; verify the generated config after Astro
builds because adapter-generated bindings can differ from the source.

Start the preview CMS fresh. Do not export or copy production D1 data, media,
users, sessions, or secrets into it. EmDash initializes its own schema; do not
apply the archived visitor-auth migrations to the preview `DB`. Until the owner
completes protected first-admin setup, a successful deployment may redirect to
setup rather than serve the portfolio. This is not application readiness.

Use a distinct preview setup key and complete setup on the preview origin.
Passkeys are origin-bound; a production passkey is not a preview administrator.
Leave preview `HOUSE_OWNER_ID` empty (fail closed) until the preview administrator
exists, then use that account's ID from `/_emdash/api/auth/me`, rebuild and redeploy
only preview. Do not copy the production owner's ID as a shortcut.

The old preview visitor database is unbound, not deleted. Old House namespaces
and test identities remain untouched, not imported into the new preview CMS.

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
two server-side secrets without putting values in Git or CI. Subsequent pushes
can deploy without a secrets file. Verify names
after an authorized deployment with
`wrangler preview secret list --name interactive-stuff`; a green build alone does
not prove secrets survived.

The first deployment must include `--secrets-file`: with Wrangler 4.135, a brand-new Preview has no version from which to inherit, even after Base secrets are configured, and otherwise fails with code 10222. Once bootstrapped, ordinary pushes need no secret values in the build environment.

Production routes and Cron Triggers do not run against branch previews. Leave them at the top level; scheduled CMS publishing runs only on production, not again on a preview. Never use `bun run deploy` to repair a preview. The published preview URL is shown by Wrangler and the Cloudflare dashboard.

After an authorized deployment, read back that exact preview deployment's
`DB`, `MEDIA`, and `SESSION` bindings and compare them with the generated preview
config and production identifiers. Verify secret names without printing values,
then check the hosted response. Report any remaining owner setup separately from
deployment success; do not bypass setup or create the owner's credentials.

## Existing standalone Alchemy previews

Alchemy consumes the current adapter's prebuilt Worker using
`Cloudflare.Worker({ main, bundle: false, assets })`. It preserves the emitted
module tree, `dist/client`, and custom entrypoint rather than installing another
Astro adapter. With pinned `alchemy@2.0.0-beta.79`, construction-time
schema-validated string config values supply the raw `DB` and `MEDIA` bindings:

- `PREVIEW_CMS_DATABASE_ID`: the provisioned preview CMS D1 ID (defaults to Wrangler's preview CMS D1 ID).
- `PREVIEW_MEDIA_BUCKET_NAME`: the provisioned preview media R2 bucket name (defaults to Wrangler's preview R2 bucket).

Both fall back to the provisioned preview resources when unset; malformed
identifiers and the existing production CMS ID/media name are strictly rejected
during construction. Supply explicit overrides if targeting a different preview
environment and check them against production before an approved Alchemy apply. Raw bindings reference those resources without
adopting or managing their lifecycle: do not also declare Alchemy D1/R2 resources
for them. This avoids competing resource owners and creating an extra CMS solely
for the transitional Alchemy stack. Stage `Sessions` remains Alchemy-owned;
do not replace it with the production or Wrangler preview namespace.

The stack also needs preview setup and Jev secrets (`Config.Redacted`) and the
preview administrator's `HOUSE_OWNER_ID`. Routes and crons are explicitly empty;
only production runs scheduled CMS publishing. The stack still declares legacy
`Visitors` with `RemovalPolicy.retain()` and an unused `HOUSE` binding as a
**data-preservation hold**. Alchemy otherwise emits a destructive class migration
when the binding is removed. These are not a second active auth or gift backend.
The Worker is also marked for retention, but that does not prevent class deletion
during an in-place update. A source-level retain policy is not enough: it must
first be applied to each existing stage and verified in its persisted state.
Removing the `HOUSE` binding also needs an explicitly approved namespace
preservation or deletion plan; there is no class-level retain switch.

Do not provision fresh stages from this transitional stack or run it as a static
check without `ALCHEMY_STATE=local`. **A first Alchemy plan can write cloud state**
via `Cloudflare.state()` bootstrap (use `ALCHEMY_STATE=local` to inspect plans locally
without remote state bootstrapping). Retain policies need an explicitly approved
apply and readback before declarations can be orphaned safely. No plan, bootstrap,
or deployment has been performed for this change. Do not run Wrangler migrations
against Alchemy-owned legacy databases; their unchanged migration history still
belongs to Alchemy.

## Existing production target

`bun run deploy` targets the Wrangler-owned production Worker, not a preview.
Keep `EMDASH_SETUP_KEY` and `JEV_API_KEY` configured as Worker secrets. Set the
exact `HOUSE_OWNER_ID` for CMS administration and moderation. Keep the verified
production administrator ID unchanged; preview uses its own administrator ID.
Preserve the existing CMS ID,
R2 bucket, KV namespace, custom domains, cron, historical `house-v1` migration,
and inert class export. Do not add `deleted_classes` or erase old resources.

Passing local checks does not authorize a cloud write or resource deletion. Do not use `--adopt`,
rename preview resources to production names, or copy old visitor IDs into `DB`.

## References

- [Alchemy state and first-run bootstrap](https://alchemy.run/state-store/)
- [Alchemy documentation index](https://alchemy.run/llms.txt) and [Secrets & Config](https://alchemy.run/environments/secrets)
- [Alchemy async Workers and prebuilt bundles](https://alchemy.run/cloudflare/compute/workers)
- [Alchemy Worker source](https://github.com/alchemy-run/alchemy/blob/main/packages/alchemy/src/Cloudflare/Workers/Worker.ts), verified against the installed beta.79 `WorkerProps` / `bundle: false` implementation
- [Cloudflare Previews: resource isolation](https://developers.cloudflare.com/workers/previews/resources/) and [configuration](https://developers.cloudflare.com/workers/previews/configuration/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), checked against installed Wrangler 4.135.0 `config-schema.json`
- [Astro Cloudflare integration](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare Durable Object class migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
