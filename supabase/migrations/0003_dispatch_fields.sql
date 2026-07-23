-- ============================================================
-- 0003: Dispatch workbook fields on purchase_orders.
--
-- The Dispatch workbook ("MP Dispatched Consignment Checklist") is the
-- source of truth for fulfillment: dispatcher_name and fill_rate come
-- straight from it, and operational_dispatch_days is derived (Dispatch
-- Date from the sheet minus this PO's own po_raised_date already in the
-- table — the sheet has no PO Date column of its own).
-- ============================================================

alter table public.purchase_orders
  add column fill_rate numeric,
  add column dispatcher_name text,
  add column operational_dispatch_days integer;
