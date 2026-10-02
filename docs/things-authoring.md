# Things authoring

The `codex/things-authoring` branch starts at `interactive-stuff` (`591af80`). Open **Plugins → Things** in EmDash, or use a Thing’s pencil in homepage edit mode. The homepage toolbar’s plus creates a Thing. The normal collection editor remains available for history, bylines, SEO, and advanced administration.

Deployed preview: https://things-authoring-liftaris-dev.kaio-8df.workers.dev. Workspace: https://things-authoring-liftaris-dev.kaio-8df.workers.dev/_emdash/admin/plugins/liftaris-things/workspace. This deployment has its own D1 database and R2 bucket. Hosted public routes/media and anonymous API denial were verified; the complete authenticated authoring flow was exercised locally using EmDash's development login. The existing preview owner identity is preserved; owner sign-in on the new hostname has not been verified.

For owner authoring, use the `interactive-stuff` branch preview after its Cloudflare build: https://interactive-stuff-liftaris-dev.kaio-8df.workers.dev/_emdash/admin/plugins/liftaris-things/workspace. The existing owner passkey is registered on that hostname. The preview bindings in this branch select the migrated Things database and dedicated media bucket; the previous preview database remains intact. Browser navigation from a gift-visitor session now redirects to native owner login and preserves the requested workspace URL. Author APIs remain owner-only.

Changes autosave as drafts; **Publish** is explicit. Select an icon before dragging it. Layout preview freezes physics, and drag completion saves normalized coordinates within the original physics bounds. Escape cancels; arrow keys move and Enter commits. Open a window and resize its edges to set initial dimensions. Numeric fields offer the same controls. Visitor gestures never write to the CMS.

A Picture is a folder with a background and no contents. Media comes from the native media library; backgrounds belong to windows. Folder appearances are ordered references. A Thing can appear on the homepage and in several folders. Its primary folder controls its URL; other appearances are shortcuts. Changing a primary folder stages membership in that folder. Publishing offers the parent dependency first when necessary. This is a resumable sequence of native saves/publications, not an atomic release.

The red X moves a Thing to trash everywhere. The workspace offers immediate restoration; EmDash’s trash supports later restoration. Removing a folder appearance only changes that folder’s draft. Published primary descendants block parent removal. Folder contents are never cascade-deleted.

## EmDash integration

- `src/plugins/things.ts` registers the native admin workspace, authenticated graph/validation reads, and lifecycle policies with explicit hook capabilities.
- `src/plugins/things/admin.tsx` uses native content operations, revision tokens, edit locks, MediaPickerModal, and PortableTextEditor with registered plugin blocks.
- `src/lib/things/model.ts` is the shared route/geometry contract. `scene.ts` adapts it to the existing renderer.
- `src/components/house/ThingAuthoring.tsx` owns the version-specific toolbar attachment and same-origin iframe messaging. The preview validates origin, frame source, session, and payload; only the inspector writes content.
- `src/server/things/read.ts` reads all pages of native content and references. Empty content stays empty; query failures propagate.
- The catch-all route, sitemap, window links, and preview use the same canonical resolver. Explicit existing Projects, Experience, GitHub, and Clump pages remain code-managed.
- Route changes record aliases with native OptionsRepository before publication. Alias lookup resolves against current published content, after matching canonical routes. A failed publication cannot redirect its still-live canonical path. Descendant aliases do not modify descendants’ drafts. This accommodates hierarchical URLs that EmDash’s collection URL patterns cannot express.

There are no Things schema writes during requests. The gifts plugin and its schema initialization retain their existing behavior.

## Migration and recovery

Production was not changed. The preview migration starts from a read-only snapshot of the previous preview: 15 Things, 3 posts, 2 media records, and 7 original revisions. The resulting copy has 19 Things, with original Thing IDs and post IDs retained. Posts remain intact in a hidden historical collection. Legacy article paths redirect. The original snapshot and media files are private and ignored by Git.

1. Use `python3 tools/snapshot-preview.py SOURCE.db` to snapshot the existing preview. Its database ID is deliberately fixed to the old preview, never production. D1’s export endpoint rejects FTS virtual tables, so the snapshot reads schema and data and reconstructs a local database.
2. Run `bun tools/migrate-things.ts SOURCE.db TARGET.db` for an inventory report. Add `--apply` to migrate a separate copy with native schema APIs and content/revision repositories. The source stays untouched. A `.pending` copy is promoted only after validation; interrupted runs can be restarted from the same source. Existing completed targets are never overwritten.
3. Validate `TARGET.db.report.json`, the published graph, pending drafts, and media before remote import. Native revision snapshots are explicitly staged before publication, so older live revisions cannot overwrite converted fields.
4. `python3 tools/export-preview.py TARGET.db TARGET.sql` produces an SQL dump for local D1 rehearsal. Restore the copy into a dedicated, empty remote preview database. Use the Cloudflare remote binding API for native triggers: the REST SQL splitter cannot parse some EmDash media-usage trigger bodies containing `CASE … END`.
5. Deploy with `bun run build` and `bunx wrangler preview --name things-authoring --secrets-file PRIVATE_FILE`. `wrangler.jsonc` assigns this branch its own preview DB and R2 bucket. Production bindings are unchanged. Never use `bun run deploy` for this preview.

The native REST import utility in `tools/import-preview.py` is restricted to this task’s preview DB and is useful for copying table data. Complex trigger restoration uses `tools/restore-preview-triggers.mjs` with Wrangler’s authenticated remote binding, without exposing a migration endpoint. Run all import steps before serving the database. Preview media has its own bucket, so removing media there cannot affect the original preview.

## Fresh installation

Use the normal EmDash seed for content/schema, then run `bun tools/finalize-things-seed.ts LOCAL_DATABASE.db` before deploying that database. `seed/things-placements.json` describes the second reference pass using slugs. EmDash 1.0.1 resolves seed references in forward order; reusable folder contents plus primary parents require this explicit second pass. The initializer uses native content/reference APIs and refuses to overwrite pending drafts. This behavior has an integration test.

## Verification

Run `bun test`, `bun run typecheck`, `bun run lint`, and `bun run build`. Run the existing real-browser gift/window suite with `HOUSE_BROWSER_TESTS=1 bun test src/lib/house/client-browser.test.ts`.

The native integration test exercises fresh seeds, private field/reference drafts, stale revision refusal, publication, trash, and restoration. Model tests cover canonical ancestry, cycles, collisions, reserved paths, and geometry round trips. The real workspace was also exercised in Chromium: creation, private draft, explicit publication, drag-to-save, resize-to-save, trash everywhere, and restoration.
