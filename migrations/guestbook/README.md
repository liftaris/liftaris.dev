# Guestbook receipt migration

Run after EmDash's core schema exists and before deploying the guestbook changes.
The migration is additive and safe to rerun. It does not move or delete legacy
Gifts, comments, media, or authors.

```sh
bunx wrangler d1 execute <target-database> --remote --file=migrations/guestbook/0001_receipts.sql
```

Use an explicit database name from the intended environment. The branch preview
uses `liftaris-things-authoring-preview`; the production binding is a different
database. Back up and rehearse against a local copy first.

The trigger stores the retry receipt in the same SQLite statement as the comment.
A failed insert rolls both back. Receipts survive comment trash and permanent
removal, preventing a delayed retry from recreating deleted messages. Old receipts
remain valid. Existing comments written by the old implementation already have
receipts; the migration does not invent fingerprints for historical messages.

The plugin does not mutate collection settings or create tables during requests.
EmDash owns comment moderation and trash; the guestbook uses typed SQL only for
visitor-owned edits and deterministic-ID creation, which EmDash 1.0.1's public
comment repository does not support. All detail reads and mutations are scoped to
guestbook targets. Updates compare the loaded timestamp and moderation status to
avoid overwriting an intervening edit or moderation decision.
