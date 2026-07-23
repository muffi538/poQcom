-- 0006: sheet_connections' two partial unique indexes (marketplace_id,
-- workbook_type) WHERE marketplace_id IS NOT NULL / (workbook_type)
-- WHERE marketplace_id IS NULL cannot be used as an ON CONFLICT arbiter
-- by supabase-js's upsert() — Postgres only matches a partial index as
-- an arbiter when the INSERT statement's ON CONFLICT clause repeats the
-- same WHERE predicate, which the JS client has no way to express. Fixed
-- by collapsing "marketplace_id IS NULL" (shared connection) to a fixed
-- sentinel via a generated column, so one ordinary (non-partial) unique
-- constraint covers both cases.
drop index if exists public.uq_sheet_connections_marketplace;
drop index if exists public.uq_sheet_connections_shared;

alter table public.sheet_connections
  add column marketplace_key uuid generated always as (coalesce(marketplace_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored;

alter table public.sheet_connections
  add constraint uq_sheet_connections_workbook_marketplace_key unique (workbook_type, marketplace_key);
