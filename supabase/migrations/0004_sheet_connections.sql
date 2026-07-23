-- ============================================================
-- 0004: Data Sync page — Google Sheet connection config lives in
-- Supabase, not Vercel env vars. sync_jobs/activity_logs already cover
-- sync history/errors; this adds only what's missing: where each
-- workbook's data actually comes from, and which per-marketplace tab.
-- ============================================================

create table public.sheet_connections (
  id uuid primary key default gen_random_uuid(),
  workbook_type text not null check (workbook_type in ('po', 'sales', 'dispatch', 'ean')),
  -- null = one shared tab covering every marketplace (filtered internally
  -- by a Marketplace/Platform column — today's real shape for Sales and
  -- Dispatch); set = this marketplace has its own tab within the
  -- workbook (today's real shape for PO).
  marketplace_id uuid references public.marketplaces(id) on delete cascade,
  sheet_url text not null,
  gid text, -- worksheet/tab id; null = the workbook's first sheet
  header_row_index integer not null default 0,
  auto_detect_header boolean not null default false,
  required_columns text[],
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One connection per (marketplace, workbook_type) when scoped, or one
-- shared connection per workbook_type when not — partial indexes because
-- a plain composite unique constraint would let unlimited null-marketplace
-- rows through (NULL is never equal to NULL in a unique index).
create unique index uq_sheet_connections_marketplace on public.sheet_connections (marketplace_id, workbook_type) where marketplace_id is not null;
create unique index uq_sheet_connections_shared on public.sheet_connections (workbook_type) where marketplace_id is null;
create index idx_sheet_connections_workbook_type on public.sheet_connections (workbook_type);

alter table public.sheet_connections enable row level security;
create policy "permissive access" on public.sheet_connections for all using (true) with check (true);

-- Dispatch/EAN syncs need their own job_type value alongside the
-- existing po_sync/sales_sync/priority_recalc.
alter table public.sync_jobs drop constraint sync_jobs_job_type_check;
alter table public.sync_jobs add constraint sync_jobs_job_type_check
  check (job_type in ('po_sync', 'sales_sync', 'dispatch_sync', 'ean_sync', 'priority_recalc'));
