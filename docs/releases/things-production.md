# Things production release

**Release branch:** `interactive-stuff` → `main`. Do not merge with automatic
production deployment enabled until the migration and cutover below are arranged.
This PR prepares code and documents the move; it does not migrate production.

## Recommendation

Use EmDash **Settings → Transfer** to copy preview into a **new production D1
and R2 bucket**, then switch the production bindings during a maintenance window.
Keep today's production resources intact. This avoids mixing two independently
edited databases, and gives this release a concrete rollback boundary.

The [native site package](https://docs.emdashcms.com/guides/site-transfer/)
includes models, entries, editorial history, relationships, SEO, and media bytes.
It requires an empty destination. It does not transfer credentials, secrets,
plugin state, or custom application tables. Import analysis and its verified
receipt provide the native integrity checks. Use those facilities instead of a
hand-written whole-database importer.

This choice makes preview the new site's content source. It is **not a merge**
with the existing production library. Review the production-only material below
before choosing it. If the existing production database and account must remain
in use, follow the additive alternative at the end instead.

## Read-only inventory, 2026-10-05

Counts include unpublished/trashed records and can change after this snapshot.
No production data was modified during this inspection.

| Item | Existing production | Preview |
| --- | --- | --- |
| EmDash in deployed branch | 0.38.0 | 1.0.1 |
| Applied core migrations | 76 | 88 |
| Things | No collection | 28 records |
| Posts | 3 published | 3 published + 1 draft |
| Media records | 10 | 5 |
| Revisions | 5 | 48 |
| Content references | 0 | 15 |
| Guestbook comments | 0 | 2 |
| Historical Gifts | No collection | 6 records |

The three matching Post slugs are `Understanding-L-Systems`, `bazaar-ghost`, and
`building-a-website`. Their Portable Text span text matches. The first two have
different stored content, including production media references; they are not
byte-identical copies. Preview's `building-a-website-again` is a draft and must
stay unpublished. Production's ten media records are absent from preview.

Preview also contains a historical `gifts` collection and old Thing revisions.
A whole-site package includes that history; do not assume the export selects
only visible homepage icons. Keep it as history or curate a disposable source
copy before exporting. Do not delete it from the working preview as a shortcut.

| Resource | Existing production | Preview |
| --- | --- | --- |
| Worker / preview | `liftaris-dev` | `interactive-stuff` |
| D1 name | `liftaris-emdash` | `liftaris-things-authoring-preview` |
| D1 UUID | `0e886ca8-384e-4090-8035-c187268c7da7` | `6bf414ef-c86a-4674-b7ab-e0dac70f7bf6` |
| R2 | `liftaris-emdash-media` | `liftaris-things-authoring-media` |
| SESSION KV | `8bf01aa04a0d44499c86e377038ad892` | `d40889cd503f4bd4912c6de7aafd5394` |
| Owner ID | `01M366VZ20X87M0WMW2Y846Z0Y` | `01M3D50BEQJSREDCCRJK91R999` |

Account: `8df695f5ca97195e8c6f4896b81be028`.
Preview: <https://interactive-stuff-liftaris-dev.kaio-8df.workers.dev>.
Production: <https://www.liftaris.dev>.

## 1. Freeze and retain recovery material

- Disable automatic production deployments in Workers Builds before merging.
  Preview builds can remain enabled. Record the currently deployed Worker version
  and its bindings, not just the current Git commit.
- Schedule a maintenance window. Freeze CMS edits while making the final export;
  block public traffic to production during setup/import, while allowing the
  owner to reach the canonical `www.liftaris.dev` origin. Include both custom
  domains and the Worker's workers.dev route in that traffic plan. Keep scheduled
  publishing/maintenance disabled on the new target until import is complete.
- Export both D1 databases with Wrangler and retain the R2 objects separately.
  Keep private backups outside Git with restricted filesystem permissions.
  Record the D1 Time Travel recovery point and secret configuration securely.
  EmDash's JSON backup is not a restore/import format; see
  [backups](https://docs.emdashcms.com/guides/backups/).

```sh
umask 077
mkdir -p .local-backups/release
bunx wrangler d1 export liftaris-emdash --remote \
  --output .local-backups/release/production.sql
bunx wrangler d1 export liftaris-things-authoring-preview --remote \
  --output .local-backups/release/preview.sql
```

Do not use `tools/import-preview.py`, the old Things v1/v2 migration scripts, or
an ordinary deployment of `seed/seed.json` to copy preview over production.
Those scripts solve earlier preview migrations, not this release's data merge.

## 2. Prepare the package in preview

Sign in with the passkey that already works on the preview origin. In **Settings
→ Transfer**, export and download the `.emdash` package. Decide whether to include
the two preview comments; exclude them if they are test messages. Retain the
package digest and counts privately. Freeze edits until the final package is
accepted, or export again after the last change.

Before proceeding, compare the three existing articles visually, including their
images. Decide whether preview's versions are the intended production versions.
Preserve production-only media in the retained old bucket and backup. If all ten
files must remain editable in the new media library, upload them through the
new CMS **after** its transfer completes. Do not populate the target library
before the transfer; that makes the destination nonempty.

Old `/_emdash/api/media/file/<storage-key>` URLs also need continuity. Inventory
those ten keys and copy their original bytes and Content-Type metadata from the
old R2 bucket to the new one under the same keys, checking for collisions first.
The installed media route reads by storage key, so this preserves old direct
links. Such object copies alone do not register media-library records; use the
native library upload for that. Keep original static files in `public/` as well.

## 3. Rehearse, then initialize an empty production target

First rehearse this procedure with disposable local or isolated resources.
A successful build is not evidence that a package can import. Require zero
unresolved import blockers and a verified receipt before the production window.
This release preparation has validated the empty bootstrap seed, but has **not**
yet completed a transfer of the final preview package.

Provision new production D1, R2, and SESSION KV resources. Use distinct names such
as `liftaris-emdash-v1`, `liftaris-emdash-media-v1`, and `liftaris-sessions-v1`;
record their actual IDs. Update only the top-level bindings in `wrangler.jsonc`.
Leave `previews` pointing at its existing resources. Keep the inert `House` export
and `house-v1` migration history; do not issue a class-deletion migration.

The normal seed creates sample posts, bylines, and Things, which would block
Site Transfer. For this one-time target bootstrap, use the checked-in empty seed
through EmDash's build-time override:

```sh
# Stop if .emdash/seed.json already exists; preserve/review that override first.
mkdir -p .emdash
cp -n seed/transfer.json .emdash/seed.json
bun install --frozen-lockfile
bun run build
```

Both the override and generated migration manifest are intentionally ignored.
Inspect `dist/server/wrangler.json` before deploying. It must identify the **new**
production resources. Run the pinned native core migration command against the
new D1 UUID, never an implicit preview or old-production target:

```sh
bun run cms migrate --status \
  --account-id 8df695f5ca97195e8c6f4896b81be028 --d1 NEW_PRODUCTION_D1_UUID
bun run cms migrate \
  --account-id 8df695f5ca97195e8c6f4896b81be028 --d1 NEW_PRODUCTION_D1_UUID
```

These commands require a scoped `CLOUDFLARE_API_TOKEN` with D1 access; obtain it
securely, never put its value in commands checked into Git. Review the displayed
target before confirming. The build's `.emdash/migrations.json` binds the command
to the installed migration set. [Core migration workflow](https://docs.emdashcms.com/deployment/core-migrations/).

Deploy that build during the maintenance window. Preserve `EMDASH_SETUP_KEY` as a
secret and `AI`/`IMAGES` bindings. Complete protected first-admin setup **on
`https://www.liftaris.dev`**, registering the production owner's passkey there.
A passkey registered on a staging hostname will not solve production login.

Read the new owner ID from `/_emdash/api/auth/me`, set top-level `HOUSE_OWNER_ID`
to that exact ID, then rebuild/redeploy. Neither the preview owner ID nor the
old production owner's ID identifies this new account. An unset/stale owner ID
fails closed after setup. Do not copy preview users, sessions, or passkeys.

## 4. Import, then apply the application-specific migration

In the new production admin, open **Settings → Transfer**, upload the package,
review analysis, and map the preview owner to the new production owner. Leave
anonymous preview visitors unmapped; their original browser sessions do not
transfer. Imported visitor comments can be moderated by the owner, but those
visitors cannot recover ownership through their preview cookies.

Start the reviewed import and retain the verified receipt. Resume interrupted
imports through the transfer UI; do not restart with SQL resets. Inspect warnings
as well as blockers. A receipt verifies EmDash's portable content, not this
application's route graph or custom tables.

After import, apply the guestbook's additive receipt migration to the **new** DB:

```sh
bunx wrangler d1 execute NEW_PRODUCTION_D1_NAME --remote \
  --file migrations/guestbook/0001_receipts.sql
```

Apply it after import so imported comments do not accidentally recreate receipts
using unmapped visitor IDs. New guestbook writes need this table and trigger.
Do **not** apply `migrations/visitor-auth` or copy preview receipt rows.

Site Transfer excludes the custom `liftaris:things:former-path:*` options. None
were present in this inspection, but check again at the final export. If any now
exist, recreate their resolved redirects through native redirect administration.
`legacy_paths` inside Thing fields travels with the content. Plugin migration
markers and archived migration snapshots are not required on the new target.

The three native plugins ship with the application build; do not try to move
compiled admin assets or plugin installations through the package. Inspect any
future plugin settings separately. Current preview plugin storage is empty.

Remove the temporary `.emdash/seed.json` override, restore the publishing cron,
rebuild, and deploy. Setup has completed, so the ordinary sample seed will not
reapply. Run `cms migrate --check` with the same explicit new D1 UUID.

## 5. Acceptance and cutover

Before reopening traffic, verify:

- Owner passkey login on **www**, Things workspace, live save, media selection,
  background changes, and separate Posts editing.
- Expected published Things and ordered folder memberships. Draft Post
  `building-a-website-again` remains invisible anonymously.
- `/projects`, `/experience`, `/github`, `/guestbook`, article `/blog/...` links,
  nested Thing routes, redirects, and canonical URLs all resolve correctly.
- Folder backgrounds and icons load from production without preview-host links;
  old media URLs still return the expected bytes and content types.
- A fresh visitor can sign the guestbook, edit their entry, and cannot edit another
  visitor's entry. Pending comments remain private. Trash the smoke-test message.
- Hover/focus prefetch, window resize/maximize/restore, mobile layout, and the
  shared emoji picker. Check Worker errors and failed browser requests.

Commit the final production binding IDs and new owner ID to `interactive-stuff`,
update the release PR, and merge only after this checklist passes. Re-enable
Workers Builds automatic production deployments and public traffic. Confirm that
the first main build preserves these exact bindings and secret names.

If validation fails, restore the recorded **old Worker version together with its
old DB, MEDIA, SESSION, and owner configuration**. Rolling code back alone against
a changed database is not rollback. If the new site has already accepted public
writes, freeze and export those before switching back so they are not lost.
Retain both resource sets until the release is accepted; deletion is separate work.

## Alternative: retain the existing production CMS

If preserving today's account, library IDs, and database in place is mandatory,
do not use Site Transfer: its target-empty check is intentional. The supported
building blocks are [schema evolution](https://docs.emdashcms.com/deployment/schema-evolution/)
and native media/content/reference APIs. Rehearse on a protected production clone,
then execute under maintenance:

1. Apply the 1.0.1 core migrations from the release build; retain production auth.
2. Add Things from `src/lib/things/schema.ts`, and add Posts' `icon` field. Keep
   Posts' drafts/revisions and Things' live-save behavior. Core migrations and
   redeploying the seed do not perform these model changes.
3. Upload preview media through the native library; record old → new IDs/URLs.
   Rewrite image fields and Portable Text references before importing entries.
4. Match existing Posts by slug and locale, preserving their production IDs,
   revisions, and content unless a reviewed change explicitly replaces them.
   Create the preview-only Post as a draft.
5. Create Things in two passes: properties first, then ordered contents,
   primary-folder, and Post references using the resulting ID map. Validate the
   complete route graph before exposing it. Handle SEO and bylines explicitly.
6. Apply the receipt SQL above to `liftaris-emdash`, verify the same acceptance
   checklist, and only then allow public traffic.

This is a selective promotion operation, not an existing one-click EmDash command.
The repository does not yet contain a rehearsed production promotion script.
Do not substitute the historical preview import scripts. Prefer the native
package/new-target route unless an in-place merge is an explicit requirement.

## Release preparation evidence

- ESLint passes; Astro type checking reports zero errors/warnings (two hints).
- Cloudflare build succeeds; it retains the existing large-chunk advisory.
- Both seed files pass native validation. The ordinary seed applies all 88 core
  migrations and creates the expected fields; Guestbook resolves to `/guestbook`.
- EmDash's own `inspectPortableDomain` reports the empty bootstrap eligible with
  no blockers on a disposable database.
- Hosted preview browser checks pass for guestbook layout, consistent button
  cursor, picker stability/scrolling at narrow sizes, and the shared background.
- The final package export/import, new production resources, owner enrollment,
  and cutover are operator steps still to complete. No production writes occurred.
