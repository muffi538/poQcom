-- ============================================================
-- 0008: Driver field on purchase_orders.
--
-- Per PO_Operations_Architecture_1.md, the Dispatch Consignment Workbook
-- carries a Driver column alongside Dispatcher — enrichment-only, same
-- as dispatcher_name/fill_rate (0003). No marketplace's dispatch mapping
-- includes a "driver" column today, so this stays null until one does;
-- the column exists so the Delivered workflow can show it the moment a
-- mapping is added, without another migration.
-- ============================================================

alter table public.purchase_orders
  add column driver_name text;
