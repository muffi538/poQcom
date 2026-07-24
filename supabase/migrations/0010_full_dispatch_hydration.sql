-- ============================================================
-- 0010: Full Dispatch-workbook hydration on purchase_orders.
--
-- Architectural fix (2026-07-24): the Dispatch importer previously wrote
-- only a subset of the real workbook's fields, and the UI computed
-- fulfilment time / fill rate fallbacks client-side. Both are wrong:
-- every field the Dispatch workbook carries for a matched PO should be
-- persisted once, at sync time, and the UI should only ever read it.
--
-- Renames (both fields had exactly one writer -- dispatch-importer.ts --
-- and were barely surfaced in the UI, confirmed via full-codebase search
-- before renaming):
--   - operational_dispatch_days -> fulfilment_days: same value (Dispatch
--     Date minus PO Raised Date), renamed to match the vocabulary this
--     is actually discussed in (Delivered workflow's "Fulfilment Time").
--   - dispatch_appt_qty -> appointment_qty: matches the Dispatch sheet's
--     own "Appt Quantity" column name.
--
-- New columns, all enrichment-only from the Dispatch workbook, null
-- until a real Dispatch sync matches the PO -- never fabricated:
--   - shipment_id: the sheet's own "PO/Shipment ID" cell value, stored
--     verbatim (pre-normalization) for audit even though it's also the
--     join key against po_number.
--   - consignment_id: reserved for a Consignment ID column if the
--     Dispatch workbook ever adds one -- the real "MP Dispatched
--     Consignment Checklist" sheet (confirmed 2026-07-24) has no such
--     column today, so this stays null. Not fabricated, not derived from
--     shipment_id/po_number.
--   - invoice, mrp_label: the sheet's Document Checklist section's own
--     "Invoice" / "MRP Lablel" boolean columns (TRUE/FALSE per
--     consignment), not free-text document data.
-- ============================================================

alter table public.purchase_orders
  rename column operational_dispatch_days to fulfilment_days;

alter table public.purchase_orders
  rename column dispatch_appt_qty to appointment_qty;

alter table public.purchase_orders
  add column shipment_id text,
  add column consignment_id text,
  add column invoice boolean,
  add column mrp_label boolean;
