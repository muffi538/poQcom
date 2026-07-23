-- 0007: Automatic sync scheduler support.
--
-- sync_jobs already tracks rows_processed (successfully handled) and
-- rows_failed (skipped/not found), but the Data Sync page needs to show
-- Rows Imported vs. Rows Updated separately (a PO sync upserts — some
-- po_numbers are brand new, some already existed) — rows_processed is
-- kept as the total for backward compatibility, these two add the split.
alter table public.sync_jobs
  add column rows_inserted integer not null default 0,
  add column rows_updated integer not null default 0;

-- Last-run marker for the scheduler — a single global auto-sync cadence
-- (one toggle + one interval, per the confirmed Data Sync page spec),
-- not tracked per-connection. Seeded so the first cron tick doesn't
-- immediately fire before any interval has elapsed.
insert into public.settings (key, value, description)
values ('auto_sync_last_run_at', 'null'::jsonb, 'Timestamp (ISO string) of the last automatic sync run, or null if never run.')
on conflict (key) do nothing;
