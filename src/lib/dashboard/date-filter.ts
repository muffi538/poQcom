import { PurchaseOrder } from "@/types/purchase-order";

// Which PO date field the filter narrows on — confirmed default is PO
// Issue Date (poRaisedDate), with Expiry Date and Dispatch Date as
// switchable alternatives via the small dropdown beside the date filter.
export type DateFilterField = "po_date" | "expiry_date" | "dispatch_date";

export type DateFilterPreset =
  | "all_time"
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export interface DateFilterState {
  preset: DateFilterPreset;
  field: DateFilterField;
  customFrom: string | null; // ISO date (yyyy-mm-dd), only meaningful when preset === "custom"
  customTo: string | null;
}

export const DEFAULT_DATE_FILTER: DateFilterState = {
  preset: "all_time",
  field: "po_date",
  customFrom: null,
  customTo: null,
};

export const DATE_FILTER_PRESET_LABELS: Record<DateFilterPreset, string> = {
  all_time: "All Time",
  today: "Today",
  yesterday: "Yesterday",
  last_7_days: "Last 7 Days",
  last_30_days: "Last 30 Days",
  this_month: "This Month",
  last_month: "Last Month",
  this_quarter: "This Quarter",
  this_year: "This Year",
  custom: "Custom Range",
};

export const DATE_FILTER_FIELD_LABELS: Record<DateFilterField, string> = {
  po_date: "PO Date",
  expiry_date: "Expiry Date",
  dispatch_date: "Dispatch Date",
};

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// UTC-based, matching the rest of the app's "today" convention
// (computeTimeline uses today.toISOString().slice(0,10)) — date-only
// math, deliberately not calendar-timezone-aware, so a preset means the
// same range regardless of the server's local timezone.
function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfMonth(d: Date, monthOffset = 0): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + monthOffset, 1));
}

function endOfMonth(d: Date, monthOffset = 0): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + monthOffset + 1, 0));
}

function startOfQuarter(d: Date): Date {
  const quarterStartMonth = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), quarterStartMonth, 1));
}

function endOfQuarter(d: Date): Date {
  const quarterStartMonth = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), quarterStartMonth + 3, 0));
}

function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function endOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 11, 31));
}

// Returns an inclusive [from, to] ISO date range, or {from: null, to:
// null} for "All Time" (no filtering). Custom Range passes its own
// from/to straight through (validated by the UI, not re-derived here).
export function resolveDateRange(filter: DateFilterState, today: Date = new Date()): { from: string | null; to: string | null } {
  const todayStart = startOfDay(today);

  switch (filter.preset) {
    case "all_time":
      return { from: null, to: null };
    case "today":
      return { from: toIsoDate(todayStart), to: toIsoDate(todayStart) };
    case "yesterday": {
      const yesterday = addDays(todayStart, -1);
      return { from: toIsoDate(yesterday), to: toIsoDate(yesterday) };
    }
    case "last_7_days":
      return { from: toIsoDate(addDays(todayStart, -6)), to: toIsoDate(todayStart) };
    case "last_30_days":
      return { from: toIsoDate(addDays(todayStart, -29)), to: toIsoDate(todayStart) };
    case "this_month":
      return { from: toIsoDate(startOfMonth(todayStart)), to: toIsoDate(endOfMonth(todayStart)) };
    case "last_month":
      return { from: toIsoDate(startOfMonth(todayStart, -1)), to: toIsoDate(endOfMonth(todayStart, -1)) };
    case "this_quarter":
      return { from: toIsoDate(startOfQuarter(todayStart)), to: toIsoDate(endOfQuarter(todayStart)) };
    case "this_year":
      return { from: toIsoDate(startOfYear(todayStart)), to: toIsoDate(endOfYear(todayStart)) };
    case "custom":
      return { from: filter.customFrom, to: filter.customTo };
    default:
      return { from: null, to: null };
  }
}

function dateFieldValue(po: PurchaseOrder, field: DateFilterField): string | null {
  if (field === "po_date") return po.poRaisedDate || null;
  if (field === "expiry_date") return po.expiryDate || null;
  return po.dispatchDate;
}

// Applies the filter to a PurchaseOrder[] batch — called once, before
// everything downstream (buildExecutiveSummary/buildPoRows/
// buildTopSkuTable/charts), so every metric/table/chart/priority count
// reflects the same filtered set uniformly rather than each needing its
// own date-filtering logic.
export function filterPurchaseOrdersByDate(pos: PurchaseOrder[], filter: DateFilterState, today: Date = new Date()): PurchaseOrder[] {
  if (filter.preset === "all_time") return pos;
  const { from, to } = resolveDateRange(filter, today);
  if (!from && !to) return pos;

  return pos.filter((po) => {
    const value = dateFieldValue(po, filter.field);
    // A PO with no value in the selected date field (e.g. Dispatch Date
    // on a PO that hasn't been dispatched yet) can't be judged against
    // the range — excluded rather than guessed in either direction.
    if (!value) return false;
    if (from && value < from) return false;
    if (to && value > to) return false;
    return true;
  });
}

export function formatDateFilterBadge(filter: DateFilterState): string {
  if (filter.preset === "all_time") return "All Time";
  const presetLabel =
    filter.preset === "custom" && filter.customFrom && filter.customTo
      ? `${filter.customFrom} → ${filter.customTo}`
      : DATE_FILTER_PRESET_LABELS[filter.preset];
  return `${presetLabel} • ${DATE_FILTER_FIELD_LABELS[filter.field]}`;
}
