# Codebase review — October 2026

Reviewed from `interactive-stuff` at `63c46b9`. The changes retain the Things
workspace, separate Posts, guestbook, physics, and window appearance.

## Correctness fixes

- Removed shared Things/editor/Post Maps and the isolate-local EmDash memory
  backend. Their keys did not include the request's database or preview identity;
  invalidation could not reach other Worker isolates. Native EmDash request
  caching remains enabled. Public/editor/preview queries retain their contexts.
- Removed the extra hover `fetch()` and two-minute JavaScript HTML cache. Astro
  controls speculative prefetch, including connection preferences. PageReader
  consumes the browser cache with cancellation; editor/signed-preview windows
  navigate directly. Embedded public HTML has a short, private 30-second TTL.
- Removed the custom media-cache Worker wrapper, which overrode native mutable
  image headers with a 30-day TTL and attempted Cache API writes for HEAD.
  EmDash and Astro now own media freshness and response behavior.
- Split public guestbook snapshots from authenticated `mine` reads. EmDash
  deliberately omits caller identity on public plugin routes. Returning authors
  now receive edit controls and their own pending messages after a reload.
- Scoped comment detail, edit and trash to active guestbook targets. Other
  visitors cannot retrieve pending messages, alter unrelated comments, or revive
  spam/trash. The public detail route returns a detail record, not a snapshot.
- Validated trimmed nonempty text and real emoji IDs; moderated the location as
  well as the name and message. Clef now receives its required `model` selector,
  uses the generated AI binding, validates probabilities, and fails to pending.
- Made update writes conditional on the displayed timestamp and the stored
  moderation status. Added update rate limiting and atomic creation receipts.
  The receipt migration is explicit, additive, and repeatable; requests no
  longer create tables or change collection settings.
- Reused one guestbook form for create/edit, retained request IDs across retries,
  serialized mutations, and prevented a slow initial fetch from undoing a write.
  Native popovers handle icon selection; fields have accessible labels and use
  container-relative layout. Removed the obsolete private-audience selector,
  which the comment backend ignored, and aligned the older gift dialog's limits.
- An empty folder reference selection stays empty. Removed unused default
  content, Writing injection, and obsolete components/dependencies.
- Removed duplicate Noto Emoji font faces; Fontsource provides its unicode
  subsets. Kept guestbook CSS scoped to its window/page and preserved the paper
  gap in double borders. Astro ClientRouter handles normal navigation anchors;
  disposed windows cannot redirect after their animation completes.
- Regenerated Worker bindings, replacing `AI?: any`. Lint/typechecking exclude
  nested worktrees; Knip recognizes native admin entrypoints and migration tools.

## Native APIs and boundaries

EmDash 1.0.1's CommentRepository does not expose visitor body edits or caller-supplied
IDs. Those operations retain a small typed Kysely adapter with ownership and
visibility checks. Comments still use EmDash storage and its moderation/trash UI.
The additive SQLite trigger is necessary to couple receipt and comment creation
atomically on D1, which does not support interactive SQL transactions.

No distributed object or route cache was added: instant live Things and preview
isolation take priority over serving stale snapshots. A future distributed cache
needs an explicit freshness budget and publication/deletion verification.

Existing Things routing policy remains a separate concern: the workspace
validates the full candidate graph before saving, and native publication hooks
validate publication. EmDash's `content:beforeSave` event exposes only data fields,
not submitted slug/reference changes. Native-editor/API live relationship changes
therefore do not have the workspace's complete prospective-graph validation.
Avoid claiming all write paths provide that guarantee without a supported host
hook or a separately designed constrained editing path.

## Sources checked

Used the official [EmDash docs MCP](https://docs.emdashcms.com/mcp), then checked
contracts against installed EmDash 1.0.1 declarations and runtime code.

- [EmDash hooks](https://docs.emdashcms.com/reference/hooks/)
- [EmDash object cache](https://docs.emdashcms.com/deployment/object-cache/)
- [EmDash Cloudflare deployment](https://docs.emdashcms.com/deployment/cloudflare/)
- [EmDash content queries](https://docs.emdashcms.com/guides/querying-content/)
- [Astro prefetch](https://docs.astro.build/en/guides/prefetch/)
- [Astro view transitions](https://docs.astro.build/en/guides/view-transitions/)
- [Tailwind theme variables](https://tailwindcss.com/docs/theme)
- [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files)
- [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Clef Flash contract](https://developers.cloudflare.com/workers-ai/models/clef-flash/)

## Verification

No unit tests were added, per AGENTS.md. Completed checks:

- Type checking: zero errors and warnings (two existing hints); ESLint and Knip
  pass; the Cloudflare production build succeeds.
- Chromium/API checks on a disposable preview database: guestbook ownership,
  pending-message privacy, retry idempotency, stale-write rejection, trash,
  emoji selection, mobile overflow, and window maximize/restore all pass.
- Things workspace: create, save live, immediate anonymous visibility, trash,
  dark/light text contrast, and the separate Post editor link all pass.
- The additive receipt migration succeeds on the disposable database, including
  a second run, and on the backed-up isolated preview database.

The local media copy predates two preview images; their local 404s are a fixture
limitation, not a successful media verification. Hosted media must be checked
against the preview's current R2 data after deployment.
