-- Column mapping as data, not code. Replaces the hardcoded TAB_CONFIG /
-- toLineItem switch-statement in src/lib/sheets/marketplaces.ts: the
-- importer maps columns by header NAME (never a fixed position/index),
-- looking up which header belongs to which canonical field from this
-- table — so if a client reorders or inserts a column later, only a row
-- here changes, never the parser.
--
-- our_field is one of a small fixed vocabulary the importer understands:
-- status, po_number, po_raised_date, expiry_date, appointment_date,
-- dispatch_date, city, warehouse, sku, sku_description, ordered_qty,
-- dispatched_qty, dispatch_warehouse. Not every marketplace maps every
-- field (e.g. Zepto has no raw "city" column — it's derived from
-- "warehouse" by existing marketplace-specific logic in src/lib/po/
-- city.ts, which stays code since it's a real lookup/transform, not a
-- column rename).
create table public.import_field_mappings (
  id uuid primary key default gen_random_uuid(),
  marketplace_id uuid not null references public.marketplaces(id) on delete cascade,
  workbook_type text not null check (workbook_type in ('po', 'sales', 'dispatch')),
  our_field text not null,
  sheet_column_name text not null,
  is_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (marketplace_id, workbook_type, our_field)
);

create index idx_import_field_mappings_marketplace_workbook on public.import_field_mappings (marketplace_id, workbook_type);

alter table public.import_field_mappings enable row level security;
create policy "permissive access" on public.import_field_mappings for all using (true) with check (true);
