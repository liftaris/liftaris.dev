# Things authoring

Open **Plugins → Things**, or use a Thing’s pencil in homepage edit mode. The homepage toolbar’s plus creates a Thing. The workspace combines the real site with a property inspector that follows EmDash’s light/dark theme.

**Thing changes save directly to the live site.** There is one Save action and debounced autosave, with Unsaved, Saving, Saved, and Conflict states. Things have no draft/publish workflow. Existing revision history is retained in storage, but revision support is disabled because EmDash 1.0.1 uses it to stage saves as drafts. Native edit locks and revision tokens still protect concurrent changes.

**Posts remain a separate, visible collection**, with their native content editor, drafts, publishing, bylines, SEO, and revisions. Choose a Page Thing’s **Post** source and select a Post to display in its window. The workspace links to the native Post editor; it controls the icon/window/placement rather than duplicating article content. Unpublished Posts stay hidden from public folder/homepage appearances. Standalone Posts work at `/blog/{slug}`; linked Posts also retain their existing Thing URL, such as `/writing/my-post`.

Select an icon before dragging it. Layout preview freezes physics, and drag completion saves normalized coordinates within the original physics bounds. Escape cancels; arrow keys move and Enter commits. Open a window and resize its edges to set initial dimensions. Numeric fields offer the same controls. Visitor gestures never write to the CMS.

A Picture is a folder with a background and no contents. Media uses EmDash’s library. Folder appearances are ordered references: a Thing can appear on the homepage and in several folders. Its primary folder controls its URL; other appearances are shortcuts. Choosing a primary folder also adds membership in that folder using native saves. These are sequential operations, not an atomic release.

The red X moves a Thing to trash everywhere. Restore brings it back live. Removing a folder appearance only changes that folder. Primary descendants block parent removal. Folder contents and linked Posts are never cascade-deleted.

## Preview

Use the existing preview hostname, where the owner passkey is registered:
https://interactive-stuff-liftaris-dev.kaio-8df.workers.dev/_emdash/admin/plugins/liftaris-things/workspace

`wrangler.jsonc` selects the isolated migrated Things database and media bucket for previews. Production bindings and the previous preview database remain untouched. Browser navigation from a gift-visitor session redirects to native owner login; author APIs remain owner-only.

## Migration

There are no request-time Things schema mutations. Native schema/content APIs perform explicit migrations, and fresh-install seeds match the active schema.

- **Original model → current model:** `bun tools/migrate-things.ts SOURCE.db TARGET.db` inventories a disposable copy. Add `--apply` to migrate. The source is untouched; validated output is promoted from a `.pending` file. Existing output is never overwritten.
- **Draft-based Things → direct saves + separate Posts:** back up first, then `bun tools/migrate-things-live.ts LOCAL.db`. For the dedicated preview, bundle `tools/migrate-things-preview.ts` with `bun build --target=node --packages=external --outfile=.local-backups/migrate-preview.mjs`, then run `node .local-backups/migrate-preview.mjs PRIVATE_WRANGLER_CONFIG`. Wrangler remote bindings require Node. The runner verifies the exact nonproduction database ID.
- The incremental migration reuses original Post IDs and Thing IDs, links migrated articles to Posts, clears duplicate article bodies from Things, and restores Posts in the navigation. Newer article edits are retained, and pending article body changes become Post drafts. Pending Thing properties become live. Existing revisions and trashed entries remain stored. Per-entry markers allow interrupted runs to resume; a native options snapshot preserves pre-migration state.
- Read-only backups use `python3 tools/snapshot-preview.py OUTPUT.db --things` for the current preview (`--things` omitted selects the previous preview). Backups contain private data and are ignored by Git.
- D1 export cannot handle native FTS tables, so the snapshot utility reconstructs the schema/data. SQL import also requires `tools/restore-preview-triggers.mjs` for native trigger bodies containing `CASE … END`; this does not expose any public migration endpoint.

## Fresh installation

Apply the EmDash seed, then run `bun tools/finalize-things-seed.ts LOCAL.db` before serving it. This native second pass resolves reusable contents, primary folders, and Post references using slugs. It refuses to overwrite pending drafts. No ID editing is needed.

## Verification

Run `bun test`, `bun run typecheck`, `bun run lint`, and `bun run build`. Run real-browser gift/window regressions with `HOUSE_BROWSER_TESTS=1 bun test src/lib/house/client-browser.test.ts`.

Integration tests cover direct Thing saves, independent Post drafts, reference changes, stale revision rejection, trash/restore, fresh seeds, and resumable conversion of the prior model. Browser checks cover immediate anonymous visibility and both light/dark inspector themes.
