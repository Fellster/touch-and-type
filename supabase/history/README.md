# Supabase migration history reconciliation

On 2026-10-13 the original project migration records were archived in
`supabase/history/20261013_original_remote_history.json`.
The original import and subsequent MCP applications used different version numbers
from the canonical migration files, and several already-applied fixes had no history entry.

The live schema was checked for all 11 RLS-enabled application tables, grants,
foreign keys, workspace and display-name columns, customer personal details,
ownership and departure triggers, and the current sharing/invitation functions.
The canonical migration chain also passed a fresh isolated Supabase reset.

Only `supabase_migrations.schema_migrations` bookkeeping was reconciled to the
20 canonical GitHub migrations. No application migration was replayed and no
application data or schema was changed by this repair. The original records and
SQL remain archived for provenance, including earlier performance-only changes.

Future migrations must be generated in the repository and deployed with their
canonical version, rather than separately applying them through MCP with a new
generated version. When an emergency live fix is necessary, reconcile its
recorded version before the next automatic deployment.
