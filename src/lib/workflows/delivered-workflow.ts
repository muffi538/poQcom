import { PurchaseOrder } from "@/types/purchase-order";
import { daysBetween } from "@/lib/po/dates";

// The Delivered workflow (PO_Operations_Architecture_1.md): runs only for
// Status = Delivered, never the Priority Engine (Golden Rule #5). This
// module has no dependency on rules/, demand/, or the priority engine at
// all — that's the architectural enforcement, not just a runtime gate:
// there is no score/level field here to accidentally render.
export interface DeliveredRow {
  po: PurchaseOrder;
  fulfilmentTimeDays: number | null; // Dispatch Date − PO Date
  fillRate: number | null; // Dispatch workbook's own (Dispatched Qty / Appt Qty) × 100 — never fabricated
  dispatcherName: string | null;
  driverName: string | null;
}

export function buildDeliveredRows(pos: PurchaseOrder[]): DeliveredRow[] {
  return pos.map((po) => {
    // Fill Rate is ONLY ever the real Dispatch-workbook-sourced value
    // (po.fillRate, written by the Dispatch sync from its own Dispatched
    // Qty / Appt Qty). There is deliberately no fallback computed from
    // the PO's own Ordered/Dispatched Qty: aggregateImportLines already
    // forces dispatchedQty = orderedQty for every Delivered PO (the
    // business rule that "Delivered means fully out the door" even when
    // the Shipment Tracker sheet doesn't track dispatched qty itself),
    // so a qty-based fallback here would silently show a fabricated 100%
    // for every Delivered PO the Dispatch workbook has never actually
    // matched — exactly the "0 or incorrect value instead of blank" this
    // workflow must never show (confirmed requirement, 2026-07-24).
    const fillRate = po.fillRate;

    // Fulfilment Time uses dispatch_date regardless of which workbook
    // wrote it (the PO/Shipment Tracker sheet itself carries a Dispatch
    // Date column for some marketplaces, in addition to the Dispatch
    // workbook) — both are real, sheet-sourced dates, never invented.
    let fulfilmentTimeDays = po.operationalDispatchDays;
    if (fulfilmentTimeDays === null && po.dispatchDate && po.poRaisedDate) {
      const computed = daysBetween(po.poRaisedDate, po.dispatchDate);
      fulfilmentTimeDays = Number.isFinite(computed) ? computed : null;
    }

    return {
      po,
      fulfilmentTimeDays,
      fillRate,
      dispatcherName: po.dispatcherName,
      driverName: po.driverName,
    } satisfies DeliveredRow;
  });
}
