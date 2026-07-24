import { PurchaseOrder } from "@/types/purchase-order";
import { daysBetween } from "@/lib/po/dates";

// The Delivered workflow (PO_Operations_Architecture_1.md): runs only for
// Status = Delivered, never the Priority Engine (Golden Rule #5). This
// module has no dependency on rules/, demand/, or the priority engine at
// all — that's the architectural enforcement, not just a runtime gate:
// there is no score/level field here to accidentally render.
export interface DeliveredRow {
  po: PurchaseOrder;
  shippingDurationDays: number | null; // Dispatch Date − PO Date
  fillRate: number | null; // (Dispatched Qty / Ordered Qty) × 100
  dispatcherName: string | null;
  driverName: string | null;
}

export function buildDeliveredRows(pos: PurchaseOrder[]): DeliveredRow[] {
  return pos.map((po) => {
    // Prefer the real Dispatch-workbook-sourced fill rate (its own
    // Dispatched Qty / Appointment Qty) when the Dispatch sync has
    // touched this PO — it reflects what was actually fulfilled per
    // consignment. Fall back to the PO's own Ordered/Dispatched Qty per
    // the doc's formula only when no dispatch enrichment exists yet.
    let fillRate = po.fillRate;
    if (fillRate === null && po.orderedQty > 0) {
      fillRate = Math.round((po.dispatchedQty / po.orderedQty) * 10000) / 100;
    }

    let shippingDurationDays = po.operationalDispatchDays;
    if (shippingDurationDays === null && po.dispatchDate && po.poRaisedDate) {
      const computed = daysBetween(po.poRaisedDate, po.dispatchDate);
      shippingDurationDays = Number.isFinite(computed) ? computed : null;
    }

    return {
      po,
      shippingDurationDays,
      fillRate,
      dispatcherName: po.dispatcherName,
      driverName: po.driverName,
    } satisfies DeliveredRow;
  });
}
