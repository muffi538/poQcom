import { PurchaseOrder } from "@/types/purchase-order";

// The Delivered workflow (PO_Operations_Architecture_1.md): runs only for
// Status = Delivered, never the Priority Engine (Golden Rule #5). This
// module has no dependency on rules/, demand/, or the priority engine at
// all — that's the architectural enforcement, not just a runtime gate:
// there is no score/level field here to accidentally render.
//
// Architectural rule (2026-07-24): every dispatch-derived field (Fill
// Rate, Fulfilment Days, Dispatcher, Dispatched From, Appointment Qty,
// Shipment ID, Invoice, MRP Label, ...) is computed and stored ONCE by
// the Dispatch importer (src/lib/import/dispatch-importer.ts) at sync
// time. This module — and everything downstream of it — only ever reads
// those columns off `PurchaseOrder`. It must never recompute any of
// them, even as a "fallback": a fallback computed from the PO's own
// Ordered/Dispatched Qty would silently fabricate values (e.g. a fake
// 100% fill rate, since aggregateImportLines already forces
// dispatchedQty = orderedQty for every Delivered PO) for any PO the
// Dispatch workbook hasn't actually matched yet — exactly the "0 or
// incorrect value instead of blank" this workflow must never show.
export interface DeliveredRow {
  po: PurchaseOrder;
}

export function buildDeliveredRows(pos: PurchaseOrder[]): DeliveredRow[] {
  return pos.map((po) => ({ po }));
}

export interface DeliveredStats {
  avgFulfilmentDays: number | null;
  avgFillRate: number | null;
  bestFillRate: number | null;
  fastestDeliveryDays: number | null;
  slowestDeliveryDays: number | null;
}

// First-class KPIs for the Delivered workflow — computed purely from the
// stored (never recomputed) fulfilment_days/fill_rate columns, so a
// Delivered PO the Dispatch workbook hasn't matched simply doesn't
// contribute to these averages/extremes, rather than pulling them toward
// a fabricated value.
export function buildDeliveredStats(rows: DeliveredRow[]): DeliveredStats {
  const fulfilmentDays = rows.map((r) => r.po.fulfilmentDays).filter((v): v is number => v !== null);
  const fillRates = rows.map((r) => r.po.fillRate).filter((v): v is number => v !== null);

  const avg = (values: number[]): number | null =>
    values.length === 0 ? null : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;

  return {
    avgFulfilmentDays: avg(fulfilmentDays),
    avgFillRate: avg(fillRates),
    bestFillRate: fillRates.length === 0 ? null : Math.max(...fillRates),
    fastestDeliveryDays: fulfilmentDays.length === 0 ? null : Math.min(...fulfilmentDays),
    slowestDeliveryDays: fulfilmentDays.length === 0 ? null : Math.max(...fulfilmentDays),
  };
}
