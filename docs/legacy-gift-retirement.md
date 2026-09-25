# Legacy gift data: preservation and cutover gate

The native EmDash account / HTTP gift branch is a code change, not an automatic
deployment or data migration. It stops using Better Auth identities and House
SQLite gifts. **It does not import either store or restore ownership from an old
localStorage bearer token.** Do not describe an empty new CMS collection as a
successful migration.

## Current rollout decision

Kaio confirmed that existing local gifts are development tests, preview has no
gifts, and production has not shipped this system. No legacy gift or account
migration is required: native CMS gifts start fresh. Leave local and remote test
stores untouched. This decision does not authorize physical resource deletion.

## Storage deliberately left intact

- The production visitor binding previously contained the local sentinel
  `00000000-0000-0000-0000-000000000001`, not evidence of a provisioned production
  database. Inventory actual deployed resources before drawing conclusions.
- The former Workers Builds preview visitor database is
  `liftaris-preview-visitors`, ID `c9850c71-4143-4490-ab8d-28d487c4fb00`.
  Removing its app binding does not delete the database. The retired
  `wrangler.preview-migrations.json` is no longer a migration target.
- `migrations/visitor-auth/0001_visitor_auth.sql` is preserved unchanged as schema
  history. Do not apply it to the CMS `DB` or add cleanup/drop migrations there.
- Wrangler keeps the existing `house-v1` / `new_sqlite_classes: ["House"]`
  migration and an inert exported `House` class. There is no gift runtime binding
  and no `deleted_classes` migration. Preserve every existing House namespace,
  including per-branch and Alchemy-stage namespaces; they may contain different
  gifts and private messages. The inert class is not an export/import tool.
- Keep legacy secrets and authenticated backups privately until migration and
  rollback requirements are resolved. Removing a runtime requirement is not an
  instruction to erase the old credentials, local emulator state, or cloud data.

## Alchemy needs a staged retirement

The installed Alchemy beta.79 source establishes two important behaviors:

1. `RemovalPolicy.retain()` skips provider deletion and later forgets the resource
   from Alchemy state. The policy is persisted **on apply**, even for a no-op
   resource (`src/RemovalPolicy.ts`, `src/Apply.ts`). Removing a declaration uses
   its **previously persisted** policy (`src/Plan.ts`); a source edit alone cannot
   protect a resource removed in the same change.
2. `src/Cloudflare/Workers/WorkerProvider.ts` compares old and current Durable
   Object bindings and generates `deletedClasses` for a removed hosted class.
   Retaining the Worker resource does not suppress this in-place update logic.
   An exported JavaScript class alone is insufficient for Alchemy reconciliation.

Therefore `alchemy.run.ts` temporarily retains the exact `Visitors` logical
resource, with its unchanged migration history, but does **not** bind it to the
application. It marks both `Visitors` and `Website` for retention. The `HOUSE`
binding remains solely to prevent Alchemy from deleting the legacy namespace;
application routes must not use it. This is the one infrastructure retirement
exception to the otherwise CMS-only runtime configuration.

**Do not use this transitional Alchemy stack to provision fresh stages:** it would
create unnecessary legacy resources. Prefer Wrangler previews for new targets.
Do not rename resources, delete state, destroy the stack, or remove the `HOUSE`
declaration to obtain a cleaner plan. No plan or apply has been performed by this
change, and a first plan with `Cloudflare.state()` can bootstrap cloud resources.

For each existing stage, an operator must first approve a preservation update
and verify that the `retain` policies actually reached that stage's state. Only
a separate, reviewed change may then orphan the D1 declaration without physical
deletion. Before removing Alchemy's House binding, arrange a verified
data-preserving namespace transfer or a provider-supported preservation path;
the current provider has no class-level retain switch. Retain the compatibility
declaration until that is resolved. Never accept generated class deletions as a
normal side effect of this refactor.

## If a future rollout needs legacy data

1. Inventory the exact legacy databases, Workers, namespaces, object IDs, and
   resource owners. Back up/export legacy identities and gifts through an
   authorized mechanism. Include private messages, creation dates, attribution,
   ownership relationships, and any retry receipts needed for continuity; keep
   exports out of Git, logs, public assets, and shared caches.
2. Implement and rehearse a migration on disposable local copies. Define a
   namespaced legacy-user-to-EmDash-user mapping so IDs from different preview
   stores cannot collide. Preserve gift IDs or record an explicit mapping,
   authorship, visibility, and deleted-item semantics. Verify counts and private
   access rules against the source; back up the shared CMS before importing.
3. Choose and record an explicit **legacy-auth cutoff**. Cookie sessions cannot
   infer ownership from a prior bearer token. Continuity requires a separately
   reviewed credential-verification/linking step; matching names or trusting a
   submitted legacy user ID is not proof. Without such a bridge, obtain explicit
   approval that old gifts may remain archived or lose browser reclaim access,
   communicate that cutoff, and preserve the source for later recovery.
4. Freeze or reconcile legacy writes at the agreed cutover, verify imported gifts
   and native ownership, then approve the target deployment and rollback plan.
   Keep the source data through validation. Preservation does not imply that
   rolling back code also migrates newly created CMS gifts back to House storage.

No importer, bearer-to-cookie bridge, or physical resource retirement is supplied
here. Those are not prerequisites for the current fresh-start rollout. A future
data-preserving cutover must complete the steps above; data deletion still
requires separate explicit authorization.