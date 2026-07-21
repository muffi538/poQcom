// Shape of a normalized Purchase Order row after it's read out of Google
// Sheets. Field names here are a working draft — they will be remapped to
// whatever the real sheet's column headers turn out to be once that's
// confirmed (see /settings and the column-mapping question list).
export interface PurchaseOrder {
  id: string;
  marketplace: string;
  city: string;
  warehouse: string;
  supplier: string;

  poRaisedDate: string; // ISO date
  expiryDate: string; // ISO date
  appointmentDate: string | null; // ISO date, if scheduled
  dispatchDate: string | null; // ISO date, once dispatched

  poValue: number;
  pendingQty: number;
  orderedQty: number;
  inventoryAvailable: number;

  status: "Open" | "Dispatched" | "Expired" | "Cancelled" | (string & {});

  raw: Record<string, unknown>; // untouched source row, for debugging/audit
}

// Derived, not stored — computed by the (not-yet-built) SLA calculator from
// poRaisedDate / expiryDate / today. Kept separate from PurchaseOrder so the
// raw sheet row and the computed timeline never get confused with each other.
export interface PoTimeline {
  totalProcessingWindowDays: number;
  daysUsed: number;
  daysRemaining: number;
  slaConsumedPercent: number;
  appointmentDelayDays: number | null;
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
}
