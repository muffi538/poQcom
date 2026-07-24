-- ============================================================
-- 0009: Dispatched From + Appointment Quantity on purchase_orders.
--
-- Both come from the Dispatch Consignment Workbook, enrichment-only
-- (same as fill_rate/dispatcher_name/driver_name, 0003/0008):
--   - dispatched_from: the sheet's "Dispatched from" column — the
--     warehouse/location the consignment actually shipped from,
--     distinct from purchase_orders.warehouse (the Shipment Tracker's
--     own FC), so neither workbook's field gets silently overwritten by
--     the other's idea of "warehouse."
--   - dispatch_appt_qty: the sheet's own "Appt Quantity" column — the
--     Dispatch workbook's own view of how much was expected, kept
--     separate from purchase_orders.ordered_qty (owned by the PO
--     workbook) so the Delivered drawer can show both without either
--     value silently standing in for the other.
-- ============================================================

alter table public.purchase_orders
  add column dispatched_from text,
  add column dispatch_appt_qty numeric;
