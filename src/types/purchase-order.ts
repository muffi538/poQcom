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

// Derived, not stored — computed by the SLA calculator from poRaisedDate /
// expiryDate / today. Kept separate from PurchaseOrder so the raw sheet
// row and the computed timeline never get confused with each other.
export interface PoTimeline {
  totalProcessingWindowDays: number;
  daysUsed: number;
  daysRemaining: number;
  slaConsumedPercent: number;
  appointmentDelayDays: number | null;
  isMetroCity: boolean;
}

// Output of the (not-yet-built) priority engine for one PO.
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
}
