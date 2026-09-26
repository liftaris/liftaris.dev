# Archived visitor-auth schema

`0001_visitor_auth.sql` is the immutable schema history for the former Better Auth
database. The application now uses native EmDash users in `DB` and cookie sessions
backed by `SESSION` KV; it neither binds `VISITOR_DB` nor applies these migrations
at startup.

Do not edit applied SQL, apply it to `DB`, or add destructive cleanup migrations.
Alchemy temporarily retains the original `Visitors` declaration and migration
path to preserve existing stage resources. The archive is not a data backup or
an importer.