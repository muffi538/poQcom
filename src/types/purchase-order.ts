// One SKU line on a PO — kept per-line (not just summed into the PO
// total) because Demand Intelligence needs to know how much of a
// specific SKU is pending, not just the PO's overall qty.
export interface PoLineItem {
  sku: string;
  skuDescription: string;
  orderedQty: number;
  dispatchedQty: number;
  pendingQty: number;
}

// Shape of a normalized Purchase Order row, confirmed against the real
// Zepto/Blinkit/Instamart sheet tabs. No "supplier" field — confirmed the
// user's company is the single supplier on every PO, so there's no
// per-PO supplier to vary on. "Inventory Available" is intentionally
// absent — deferred until the Inventory tab's data quality is sorted out.
export interface PurchaseOrder {
  id: string; // PO Number
  marketplace: string;
  city: string; // derived, see src/lib/po/city.ts
  warehouse: string; // raw location/FC name the city was derived from
  sku: string;
  skuDescription: string;
  skus: string[]; // every distinct SKU code on this PO (multi-SKU POs have >1) — the join key for Demand Intelligence
  lineItems: PoLineItem[]; // one entry per SKU on this PO, with its own qty — needed for per-SKU (not just per-PO) aggregation

  poRaisedDate: string; // ISO date
  expiryDate: string; // ISO date
  appointmentDate: string | null; // ISO date, if scheduled
  dispatchDate: string | null; // ISO date, once dispatched

  orderedQty: number;
  dispatchedQty: number;
  pendingQty: number; // orderedQty - dispatchedQty (dispatchedQty defaults to 0 when the sheet doesn't track it)

  poValue: number | null; // orderedQty * SKU cost price; null when the SKU isn't in the price master

  status: string; // taken as-is from the sheet's Status column

  // Dispatch workbook fields (Supabase-only — null for any PO the
  // Dispatch sync hasn't matched yet, which is every PO before its
  // first dispatch update, not an error).
  fillRate: number | null; // (Dispatched Qty / Appt Qty) × 100, from the Dispatch sheet's own numbers
  dispatcherName: string | null;
  operationalDispatchDays: number | null; // Dispatch Date − this PO's own PO Raised Date

  raw: Record<string, unknown>; // untouched source row, for debugging/audit
}

// Statuses that mean the PO already reached a real end state — fulfilled,
// returned, cancelled, or otherwise closed out. "Terminal" here means "no
// longer relevant for Operational Delay tracking" (see computeTimeline)
// — it does NOT by itself mean "hidden from the dashboard"; Delivered/
// Dispatched get their own visible, read-only sections (confirmed:
// historical POs stay available for analytics/dispatch-performance, not
// silently thrown away) via isDeliveredStatus/isDispatchedStatus below.
// isFullyExcludedStatus is the narrower set that's genuinely hidden
// everywhere. Closed/Completed are included here (confirmed: "ignore
// expiry scoring for Delivered, Cancelled, Closed and Completed POs") but
// not in isFullyExcludedStatus — they still show up in "Needs Review"
// rather than disappearing, since nobody's asked for a dedicated section
// for them yet.
const TERMINAL_STATUS_EXACT = new Set(["delivered", "cancel", "cancelled", "rto done", "closed", "completed"]);

export function isTerminalStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  if (TERMINAL_STATUS_EXACT.has(normalized)) return true;
  // Catches courier-specific variants like "Dispatched Safexpress".
  return normalized.startsWith("dispatched");
}

export function isDeliveredStatus(status: string): boolean {
  return status.trim().toLowerCase() === "delivered";
}

// Catches courier-specific variants like "Dispatched Safexpress".
export function isDispatchedStatus(status: string): boolean {
  return status.trim().toLowerCase().startsWith("dispatched");
}

// RTO Done is fully excluded everywhere — nothing to dispatch, nothing
// to learn about timing, and no operations team has asked to see it.
// Cancel/Cancelled used to sit in this same set (silently hidden) but
// now get their own visible "Cancelled" tab (confirmed) via
// isCancelledStatus below, so they're deliberately NOT in this set.
const FULLY_EXCLUDED_STATUS_EXACT = new Set(["rto done"]);

export function isFullyExcludedStatus(status: string): boolean {
  return FULLY_EXCLUDED_STATUS_EXACT.has(status.trim().toLowerCase());
}

export function isCancelledStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "cancel" || normalized === "cancelled";
}

// Confirmed: "Low Value Cant Dispatch" is fully excluded too, same as
// Cancel/Cancelled/RTO Done — these POs are never going to be dispatched.
export function isLowValueCantDispatch(status: string): boolean {
  return status.trim().toLowerCase() === "low value cant dispatch";
}

export function isExpiredStatus(status: string): boolean {
  return status.trim().toLowerCase() === "expired";
}

export function isPendingStatus(status: string): boolean {
  return status.trim().toLowerCase() === "pending";
}

// Routes a PO to exactly one bucket, per the confirmed status handling:
// only "Pending" runs through the priority scoring chain. "Expired",
// "Dispatched", "Delivered", and "Cancelled" each get their own
// read-only section/tab instead of being mixed into the ranked table or
// silently dropped. Only RTO Done/Low Value Cant Dispatch are hidden
// entirely — nobody's asked to see those. Anything else (Price issue,
// Scheduled, Revised appt. required, ...) is real, unclassified ground —
// surfaced as "Needs Review" rather than silently scored or hidden,
// until confirmed.
export type StatusBucket =
  | "pending"
  | "expired"
  | "dispatched"
  | "delivered"
  | "cancelled"
  | "excluded"
  | "needs_review";

export function classifyStatus(status: string): StatusBucket {
  if (isFullyExcludedStatus(status) || isLowValueCantDispatch(status)) return "excluded";
  if (isCancelledStatus(status)) return "cancelled";
  if (isDeliveredStatus(status)) return "delivered";
  if (isDispatchedStatus(status)) return "dispatched";
  if (isExpiredStatus(status)) return "expired";
  if (isPendingStatus(status)) return "pending";
  return "needs_review";
}

// Derived, not stored — computed from poRaisedDate / expiryDate / today.
// Kept separate from PurchaseOrder so the raw sheet row and the computed
// timeline never get confused with each other.
//
// SLA % consumed was retired (confirmed: misleading for this workflow) —
// operationalDelayDays is the replacement, and the primary priority
// signal: how many days past its own expiry date a still-outstanding PO
// is, using today's actual date, never a hardcoded one.
export interface PoTimeline {
  totalProcessingWindowDays: number;
  daysUsed: number;
  daysRemaining: number; // expiryDate − today; negative once overdue
  // today − expiryDate, only computed for non-Delivered POs with a valid
  // expiry date; null when Delivered or expiry date is blank/unparseable
  // ("Unknown" in the UI). Positive = days late, 0 = due today, negative
  // = days remaining — i.e. -daysRemaining, gated by those two cases.
  operationalDelayDays: number | null;
  isOverdue: boolean; // operationalDelayDays !== null && operationalDelayDays > 0
  hasDataError: boolean; // PO Raised Date is after Expiry Date
  // Gap between Expiry Date and Appointment Date — kept for the existing
  // confirmed "Appointment Delay > 2 days" rule (a different question
  // from operationalDelayDays: this is about the appointment being
  // booked late, not about the PO itself being overdue today).
  appointmentDelayDays: number | null;
  appointmentScheduledTooLate: boolean; // Appointment Date is after Expiry Date
  isMetroCity: boolean;
}

// One of this PO's SKUs that matched the Demand Intelligence sales data
// for its own marketplace — structured (not just prose) so the UI can
// render a visible tag/badge, not only a buried explanation sentence.
export interface DemandSkuHit {
  sku: string;
  rank: number; // #1 = highest GMV within this marketplace's sales data
  gmv: number;
  points: number; // this hit's contribution to the PO's score
}

// Output of the priority engine for one PO.
export interface PoPriorityResult {
  poId: string;
  score: number;
  level: "Critical" | "High" | "Medium" | "Low" | "Unscored";
  appliedRuleIds: string[];
  skippedRuleIds: string[];
  flags: string[];
  confidence: number;
  explanation: string[];
  recommendedActions: string[];
  demandHits: DemandSkuHit[]; // sorted best-rank first; empty when no SKU on this PO has sales data
}
