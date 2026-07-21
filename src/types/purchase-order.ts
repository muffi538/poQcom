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

// Statuses treated as terminal — excluded from "active PO" counts and
// priority scoring. Confirmed against the sheet's real status vocabulary
// (which uses words like "Delivered"/"RTO Done", not "Cancelled/Closed"):
// anything that means the PO already reached an end state — fulfilled,
// returned, cancelled, or expired — is terminal. Statuses that still need
// ops attention (Pending, Scheduled, Price issue, Low Value Cant Dispatch,
// Revised appt. required) stay active.
const TERMINAL_STATUS_EXACT = new Set([
  "delivered",
  "cancel",
  "cancelled",
  "rto done",
  "dispatched",
  "expired",
]);

export function isTerminalStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  if (TERMINAL_STATUS_EXACT.has(normalized)) return true;
  // Catches courier-specific variants like "Dispatched Safexpress".
  return normalized.startsWith("dispatched");
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
