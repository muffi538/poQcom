-- Frido Q-Commerce Operations Dashboard — normalized production schema.
-- Replaces the placeholder rules/rule_groups/rule_history tables (no
-- production data in them) with a full schema covering marketplaces,
-- uploads/syncs, purchase orders + line items, sales records, the
-- priority rule engine (grouped, per-marketplace enable/disable), a
-- latest-only priority score cache, a generic activity log, and
-- key-value settings.
--
-- Design notes that apply across every table below:
--   * uuid primary keys via gen_random_uuid() (built into Postgres 13+).
--   * created_at/updated_at on every table except activity_logs, which
--     is an immutable append-only log (created_at only).
--   * RLS is enabled everywhere but every policy is permissive
--     (`using (true)`) for now — this app has no login flow yet, so a
--     policy gated on auth.uid() would lock the dashboard out entirely.
--     TIGHTEN THESE POLICIES the moment Supabase Auth is wired up.
--   * No marketplace is ever hardcoded into a CHECK constraint or enum —
--     `marketplaces` is a plain data table, so adding one is an INSERT,
--     never a migration.

-- ============================================================
-- 0. Drop the placeholder tables from the earlier Rules Builder
--    migration — confirmed no production data exists in them yet.
-- ============================================================
drop table if exists public.rule_history;
drop table if exists public.rules;
drop table if exists public.rule_groups;

-- ============================================================
-- 1. marketplaces
-- ============================================================
create table public.marketplaces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  theme_color_primary text,
  theme_color_accent text,
  -- Google Sheets sync config for marketplaces that use it (gid, sheet
  -- URL override, header auto-detection, required columns, PO-number
  -- column, min-PO-year floor) — null for upload-only marketplaces.
  sheet_config jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. sync_jobs — one row per ingestion or recalculation run,
--    regardless of source (Google Sheets, manual upload, future ERP).
-- ============================================================
create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  marketplace_id uuid references public.marketplaces(id), -- nullable: a job can span every marketplace
  source text not null check (source in ('google_sheet', 'manual_upload', 'erp')),
  job_type text not null check (job_type in ('po_sync', 'sales_sync', 'priority_recalc')),
  status text not null default 'pending' check (status in ('pending', 'running', 'success', 'failed', 'partial')),
  started_at timestamptz,
  completed_at timestamptz,
  rows_processed integer not null default 0,
  rows_failed integer not null default 0,
  error_message text,
  triggered_by uuid references auth.users(id), -- null = automated, no human trigger
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sync_jobs_marketplace_id on public.sync_jobs (marketplace_id);
create index idx_sync_jobs_status on public.sync_jobs (status);
create index idx_sync_jobs_job_type on public.sync_jobs (job_type);
create index idx_sync_jobs_created_at on public.sync_jobs (created_at desc);

-- ============================================================
-- 3. po_uploads — one row per PO batch; every purchase_orders row
--    belongs to exactly one of these (enforced via NOT NULL FK below).
-- ============================================================
create table public.po_uploads (
  id uuid primary key default gen_random_uuid(),
  marketplace_id uuid not null references public.marketplaces(id),
  sync_job_id uuid not null references public.sync_jobs(id),
  source_file_name text, -- null for Google Sheets syncs, set for manual uploads
  row_count integer,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_po_uploads_marketplace_id on public.po_uploads (marketplace_id);
create index idx_po_uploads_sync_job_id on public.po_uploads (sync_job_id);
create index idx_po_uploads_created_at on public.po_uploads (created_at desc);

-- ============================================================
-- 4. sales_uploads — mirror of po_uploads for the Demand Intelligence
--    sales sheet. No marketplace_id here: the sales sheet spans every
--    marketplace via its own Platform column (see sales_records).
-- ============================================================
create table public.sales_uploads (
  id uuid primary key default gen_random_uuid(),
  sync_job_id uuid not null references public.sync_jobs(id),
  source_file_name text,
  row_count integer,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sales_uploads_sync_job_id on public.sales_uploads (sync_job_id);
create index idx_sales_uploads_created_at on public.sales_uploads (created_at desc);

-- ============================================================
-- 5. purchase_orders — the PO header.
-- ============================================================
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null,
  marketplace_id uuid not null references public.marketplaces(id),
  po_upload_id uuid not null references public.po_uploads(id), -- every PO traces to exactly one upload
  status text not null, -- free text, deliberately unconstrained: never invent/reject a sheet's own status
  city text,
  warehouse text,
  po_raised_date date,
  expiry_date date,
  appointment_date date,
  dispatch_date date,
  ordered_qty integer not null default 0,
  dispatched_qty integer not null default 0,
  pending_qty integer generated always as (greatest(ordered_qty - dispatched_qty, 0)) stored,
  po_value numeric(14, 2),
  raw_data jsonb, -- untouched source row(s), for debugging/audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_purchase_orders_marketplace_po_number unique (marketplace_id, po_number)
);

-- Dashboard-filter-optimized indexes: Marketplace, Status, City, Expiry
-- Date, PO Date, PO Number are the confirmed filter/sort columns.
create index idx_purchase_orders_po_number on public.purchase_orders (po_number);
create index idx_purchase_orders_status on public.purchase_orders (status);
create index idx_purchase_orders_marketplace_status on public.purchase_orders (marketplace_id, status);
create index idx_purchase_orders_city on public.purchase_orders (city);
create index idx_purchase_orders_expiry_date on public.purchase_orders (expiry_date);
create index idx_purchase_orders_po_raised_date on public.purchase_orders (po_raised_date);
create index idx_purchase_orders_po_upload_id on public.purchase_orders (po_upload_id);

-- ============================================================
-- 6. purchase_order_items — per-SKU lines within a PO.
-- ============================================================
create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  sku text not null,
  sku_description text,
  ordered_qty integer not null default 0,
  dispatched_qty integer not null default 0,
  pending_qty integer generated always as (greatest(ordered_qty - dispatched_qty, 0)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_po_items_purchase_order_id on public.purchase_order_items (purchase_order_id);
create index idx_po_items_sku on public.purchase_order_items (sku);

-- ============================================================
-- 7. sales_records — raw imported sales rows (Demand Intelligence),
--    kept at import granularity rather than pre-aggregated so a future
--    fix to the ranking/aggregation logic never needs a re-import.
--    Every row traces to exactly one sales_upload (NOT NULL FK).
-- ============================================================
create table public.sales_records (
  id uuid primary key default gen_random_uuid(),
  sales_upload_id uuid not null references public.sales_uploads(id),
  marketplace_id uuid references public.marketplaces(id), -- resolved from the sheet's Platform text; null if unmapped
  platform text not null, -- raw Platform value, kept even when marketplace_id resolves (debugging unmapped values)
  category text,
  sub_category text,
  master_sku text not null, -- join key against purchase_order_items.sku
  sku_id text, -- marketplace-internal SKU id (e.g. Blinkit's own numeric id) — never used for matching
  product_name text,
  gmv numeric(14, 2) not null default 0,
  units integer not null default 0,
  asp numeric(14, 2),
  spend numeric(14, 2),
  tacos_pct numeric(6, 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sales_records_marketplace_id on public.sales_records (marketplace_id);
create index idx_sales_records_master_sku on public.sales_records (master_sku);
create index idx_sales_records_marketplace_sku on public.sales_records (marketplace_id, master_sku);
create index idx_sales_records_sales_upload_id on public.sales_records (sales_upload_id);

-- ============================================================
-- 8. priority_rule_groups — named groups (Expiry Rules, Demand Rules,
--    City Rules, Quantity Rules, Manual Rules, ...). Adding a new group
--    is a plain INSERT, never a migration.
-- ============================================================
create table public.priority_rule_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 9. priority_rules — the rule engine's rule definitions.
-- ============================================================
create table public.priority_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  enabled boolean not null default true,
  display_order integer not null default 0, -- "order" is a reserved word, hence the rename
  group_id uuid references public.priority_rule_groups(id),
  -- true = applies to every marketplace by default, with per-marketplace
  -- exceptions expressed as disabled rows in priority_rule_marketplaces;
  -- false = applies ONLY to marketplaces with an explicit enabled row.
  applies_to_all_marketplaces boolean not null default true,
  conditions jsonb not null, -- the recursive condition tree — always read/written as one unit, not normalized further
  on_match text not null default 'continue' check (on_match in ('stop', 'continue')),
  score_mode text not null check (score_mode in ('accumulate', 'override')),
  score_delta integer,
  add_flags text[],
  reason text,
  recommended_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  version integer not null default 1
);

create index idx_priority_rules_group_id on public.priority_rules (group_id);
create index idx_priority_rules_enabled on public.priority_rules (enabled);

-- ============================================================
-- 10. priority_rule_marketplaces — per-(rule, marketplace) enable
--     switch, so a rule can be on globally but off for one marketplace,
--     or scoped to only a subset of marketplaces.
-- ============================================================
create table public.priority_rule_marketplaces (
  priority_rule_id uuid not null references public.priority_rules(id) on delete cascade,
  marketplace_id uuid not null references public.marketplaces(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (priority_rule_id, marketplace_id)
);

create index idx_priority_rule_marketplaces_marketplace_id on public.priority_rule_marketplaces (marketplace_id);

-- ============================================================
-- 11. priority_scores — latest-only cache of the priority engine's
--     output per PO. One row per purchase_order_id (enforced by the
--     unique constraint), upserted after every sync/upload-triggered
--     recalculation — never an append-only history.
-- ============================================================
create table public.priority_scores (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null unique references public.purchase_orders(id) on delete cascade,
  score integer not null,
  level text not null check (level in ('Critical', 'High', 'Medium', 'Low', 'Unscored')),
  applied_rule_ids uuid[],
  flags text[],
  explanation text[],
  recommended_actions text[],
  confidence numeric(4, 3),
  demand_hits jsonb,
  computed_at timestamptz not null default now(),
  sync_job_id uuid not null references public.sync_jobs(id), -- the priority_recalc job that produced this row
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_priority_scores_level on public.priority_scores (level);
create index idx_priority_scores_score on public.priority_scores (score desc);
create index idx_priority_scores_sync_job_id on public.priority_scores (sync_job_id);

-- ============================================================
-- 12. activity_logs — the one audit trail for the whole app,
--     including every rule change (created/updated/deleted/enabled/
--     disabled/weight changed) that used to live in rule_history.
--     Immutable: created_at only, no updated_at.
-- ============================================================
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id), -- null = system/automated action
  action text not null, -- e.g. 'rule.created', 'rule.enabled', 'rule.weight_changed', 'po.status_override', 'sync.triggered'
  entity_type text not null, -- e.g. 'priority_rule', 'purchase_order', 'settings', 'sync_job'
  entity_id uuid, -- intentionally no FK: polymorphic reference across different tables
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_activity_logs_actor_id on public.activity_logs (actor_id);
create index idx_activity_logs_entity on public.activity_logs (entity_type, entity_id);
create index idx_activity_logs_created_at on public.activity_logs (created_at desc);
create index idx_activity_logs_action on public.activity_logs (action);

-- ============================================================
-- 13. settings — key-value app config, replaces the EngineConfig JSON
--     file (metro cities, level thresholds, metro-city score bonus).
--     New settings are a plain INSERT, never a migration.
-- ============================================================
create table public.settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- ============================================================
-- Row Level Security — enabled everywhere, permissive for now (see
-- the design note at the top of this file: no auth exists yet).
-- ============================================================
alter table public.marketplaces enable row level security;
alter table public.sync_jobs enable row level security;
alter table public.po_uploads enable row level security;
alter table public.sales_uploads enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.sales_records enable row level security;
alter table public.priority_rule_groups enable row level security;
alter table public.priority_rules enable row level security;
alter table public.priority_rule_marketplaces enable row level security;
alter table public.priority_scores enable row level security;
alter table public.activity_logs enable row level security;
alter table public.settings enable row level security;

create policy "permissive access" on public.marketplaces for all using (true) with check (true);
create policy "permissive access" on public.sync_jobs for all using (true) with check (true);
create policy "permissive access" on public.po_uploads for all using (true) with check (true);
create policy "permissive access" on public.sales_uploads for all using (true) with check (true);
create policy "permissive access" on public.purchase_orders for all using (true) with check (true);
create policy "permissive access" on public.purchase_order_items for all using (true) with check (true);
create policy "permissive access" on public.sales_records for all using (true) with check (true);
create policy "permissive access" on public.priority_rule_groups for all using (true) with check (true);
create policy "permissive access" on public.priority_rules for all using (true) with check (true);
create policy "permissive access" on public.priority_rule_marketplaces for all using (true) with check (true);
create policy "permissive access" on public.priority_scores for all using (true) with check (true);
create policy "permissive access" on public.activity_logs for all using (true) with check (true);
create policy "permissive access" on public.settings for all using (true) with check (true);
