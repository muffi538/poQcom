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

  poRaisedDate: string; // ISO date
  expiryDate: string; // ISO date
  appointmentDate: string | null; // ISO date, if scheduled
  dispatchDate: string | null; // ISO date, once dispatched

  orderedQty: number;
  dispatchedQty: number;
  pendingQty: number; // orderedQty - dispatchedQty (dispatchedQty defaults to 0 when the sheet doesn't track it)

  poValue: number | null; // orderedQty * SKU cost price; null when the SKU isn't in the price master

  status: string; // taken as-is from the sheet's Status column

  raw: Record<string, unknown>; // untouched source row, for debugging/audit
}

// Statuses that mean the PO already reached a real end state — fulfilled,
// returned, or cancelled. Fully excluded everywhere (confirmed).
const TERMINAL_STATUS_EXACT = new Set(["delivered", "cancel", "cancelled", "rto done"]);

export function isTerminalStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  if (TERMINAL_STATUS_EXACT.has(normalized)) return true;
  // Catches courier-specific variants like "Dispatched Safexpress".
  return normalized.startsWith("dispatched");
}

// Confirmed: "Low Value Cant Dispatch" is fully excluded too, same as
// terminal statuses — these POs are never going to be dispatched.
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
// only "Pending" runs through the priority scoring chain. "Expired" gets
// its own section instead of being mixed into the ranked table. Terminal
// and Low Value Cant Dispatch are hidden entirely. Anything else
// (Price issue, Scheduled, Revised appt. required, ...) is real,
// unclassified ground — surfaced as "Needs Review" rather than silently
// scored or silently hidden, until confirmed.
export type StatusBucket = "pending" | "expired" | "excluded" | "needs_review";

export function classifyStatus(status: string): StatusBucket {
  if (isTerminalStatus(status) || isLowValueCantDispatch(status)) return "excluded";
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
