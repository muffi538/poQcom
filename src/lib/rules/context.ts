import { PurchaseOrder, PoTimeline } from "@/types/purchase-order";
import { EvalContext } from "./engine";

// Flattens a PO + its computed timeline into the field-keyed context the
// rule engine evaluates conditions against. Keys must match field-catalog.ts.
export function buildEvalContext(po: PurchaseOrder, timeline: PoTimeline): EvalContext {
  return {
    marketplace: po.marketplace,
    city: po.city,
    warehouse: po.warehouse,
    status: po.status,
    sku: po.sku,
    poRaisedDate: po.poRaisedDate,
    expiryDate: po.expiryDate,
    appointmentDate: po.appointmentDate,
    dispatchDate: po.dispatchDate,
    orderedQty: po.orderedQty,
    dispatchedQty: po.dispatchedQty,
    pendingQty: po.pendingQty,
    poValue: po.poValue,
    daysRemaining: timeline.daysRemaining,
    operationalDelayDays: timeline.operationalDelayDays,
    isOverdue: timeline.isOverdue,
    appointmentDelayDays: timeline.appointmentDelayDays,
    isMetroCity: timeline.isMetroCity,
  };
}
