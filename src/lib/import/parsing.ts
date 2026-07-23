import { ImportLineItem } from "./types";
import { isDeliveredStatus, isDispatchedStatus } from "@/types/purchase-order";

// Marketplace-agnostic parsing primitives, extracted so both the
// database-backed importer (src/lib/import/*) and anything reading a
// workbook share one implementation — a bug fixed here is fixed
// everywhere, not just for whichever caller happened to get patched.

export function toNumber(value: string | undefined): number {
  const n = Number((value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Scans the first few rows for whichever one contains every required
// column name exactly — so a sheet's merged/cosmetic title row above the
// real header doesn't need a hardcoded row-offset number. Throws naming
// exactly which required column is missing, rather than silently parsing
// the wrong row as if it were the header.
export function detectHeaderRow(
  rows: string[][],
  requiredColumns: string[],
  label: string,
  scanLimit = 20
): { headerRowIndex: number; header: string[] } {
  const limit = Math.min(scanLimit, rows.length);
  let bestIndex = -1;
  let bestMatchCount = -1;
  for (let i = 0; i < limit; i++) {
    const matchCount = requiredColumns.filter((col) => rows[i].includes(col)).length;
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestIndex = i;
    }
  }
  if (bestIndex === -1) {
    throw new Error(`${label}: sheet appears to be empty — no header row found.`);
  }

  const header = rows[bestIndex];
  const missing = requiredColumns.filter((col) => !header.includes(col));
  if (missing.length > 0) {
    throw new Error(
      `${label}: required column(s) not found in the sheet: ${missing.join(", ")}. ` +
        `Closest header row (row ${bestIndex + 1}) contains: ${header.filter(Boolean).join(", ")}. ` +
        `If the sheet's real header text differs, fix the mapping (Data Sync > column mapping) — not the parser.`
    );
  }
  return { headerRowIndex: bestIndex, header };
}

// Canonical status vocabulary (confirmed mapping) — matched
// case-insensitively and trimmed. Any other non-blank text is preserved
// as-is rather than discarded. A genuinely blank/undeterminable status
// (the PO's anchor row had an empty Status cell) is never silently
// treated as Pending — it becomes "Unknown", logged as a warning.
export const STATUS_ALIASES: Record<string, string> = {
  pending: "Pending",
  delivered: "Delivered",
  dispatched: "Dispatched",
  "dispatch scheduled": "Dispatch Scheduled",
  cancelled: "Cancelled",
  cancel: "Cancelled",
  rejected: "Rejected",
  closed: "Closed",
  completed: "Completed",
  scheduled: "Scheduled",
};

export function normalizeStatus(raw: string, poNo: string, label: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    console.warn(`[${label}] PO ${poNo}: anchor row's Status cell was blank — set to "Unknown" (not defaulted to Pending).`);
    return "Unknown";
  }
  return STATUS_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

// One PO's worth of rows, grouped by PO Number *wherever it appears in
// the sheet* — not assumed to be contiguous. The same PO Number can
// legitimately appear in more than one place (e.g. a SKU added to an
// existing PO later in the file); treating each occurrence as a separate
// block would silently split one PO's quantity across two rows. A blank
// PO Number continues whichever PO most recently had a non-blank one.
export interface PoBlock {
  poNo: string;
  lines: ImportLineItem[];
}

export function groupIntoPoBlocks(lines: ImportLineItem[]): PoBlock[] {
  const byPoNo = new Map<string, PoBlock>();
  const order: PoBlock[] = [];
  let lastPoNo = "";

  for (const line of lines) {
    const poNo = line.poNo.trim() || lastPoNo;
    if (!poNo) continue;
    lastPoNo = poNo;

    let block = byPoNo.get(poNo);
    if (!block) {
      block = { poNo, lines: [] };
      byPoNo.set(poNo, block);
      order.push(block);
    }
    block.lines.push(line);
  }
  return order;
}

// Picks the first non-blank value for a PO-level field across an entire
// PO block, rather than trusting its first row — correct regardless of
// which row a merged cell's real value happens to be anchored on.
export function firstNonBlank<T extends string | null>(group: ImportLineItem[], select: (line: ImportLineItem) => T): T {
  for (const line of group) {
    const value = select(line);
    if (value !== null && value !== "") return value;
  }
  return select(group[0]);
}

export interface AggregatedPo {
  poNo: string;
  status: string;
  city: string;
  warehouse: string;
  poRaisedDate: string | null;
  expiryDate: string | null;
  appointmentDate: string | null;
  dispatchDate: string | null;
  orderedQty: number;
  dispatchedQty: number;
  pendingQty: number;
  poValue: number | null;
  items: Array<{ sku: string; skuDescription: string; orderedQty: number; dispatchedQty: number; pendingQty: number }>;
}

// Groups line items into POs and applies the confirmed business rule
// that Delivered/Dispatched POs are fully out the door (Dispatched Qty =
// Ordered Qty, Pending Qty = 0) regardless of what the sheet's own
// dispatched-qty column says — several sheets don't track it at all.
export function aggregateImportLines(lines: ImportLineItem[], label: string, priceMap: Map<string, number>): AggregatedPo[] {
  const blocks = groupIntoPoBlocks(lines);
  const result: AggregatedPo[] = [];

  for (const block of blocks) {
    const group = block.lines;
    const city = firstNonBlank(group, (l) => l.city);
    const warehouse = firstNonBlank(group, (l) => l.warehouse);
    const rawStatus = firstNonBlank(group, (l) => l.status);
    const status = normalizeStatus(rawStatus, block.poNo, label);
    const poRaisedDate = firstNonBlank(group, (l) => l.poRaisedDate);
    const expiryDate = firstNonBlank(group, (l) => l.expiryDate);
    const appointmentDate = firstNonBlank(group, (l) => l.appointmentDate);
    const dispatchDate = firstNonBlank(group, (l) => l.dispatchDate);

    let orderedQty = 0;
    let dispatchedQty = 0;
    let poValue: number | null = 0;
    let hasKnownPrice = false;
    for (const line of group) {
      orderedQty += line.orderedQty;
      dispatchedQty += line.dispatchedQty;
      const costPrice = priceMap.get(line.sku);
      if (costPrice !== undefined) {
        poValue = (poValue ?? 0) + line.orderedQty * costPrice;
        hasKnownPrice = true;
      }
    }
    if (!hasKnownPrice) poValue = null;

    const fullyDispatched = isDeliveredStatus(status) || isDispatchedStatus(status);
    if (fullyDispatched) dispatchedQty = orderedQty;

    const itemsBySku = new Map<string, { sku: string; skuDescription: string; orderedQty: number; dispatchedQty: number; pendingQty: number }>();
    for (const line of group) {
      if (!line.sku) continue;
      const lineDispatchedQty = fullyDispatched ? line.orderedQty : line.dispatchedQty;
      const existing = itemsBySku.get(line.sku);
      if (existing) {
        existing.orderedQty += line.orderedQty;
        existing.dispatchedQty += lineDispatchedQty;
        existing.pendingQty = Math.max(0, existing.orderedQty - existing.dispatchedQty);
      } else {
        itemsBySku.set(line.sku, {
          sku: line.sku,
          skuDescription: line.skuDescription,
          orderedQty: line.orderedQty,
          dispatchedQty: lineDispatchedQty,
          pendingQty: Math.max(0, line.orderedQty - lineDispatchedQty),
        });
      }
    }

    result.push({
      poNo: block.poNo,
      status,
      city,
      warehouse,
      poRaisedDate,
      expiryDate,
      appointmentDate,
      dispatchDate,
      orderedQty,
      dispatchedQty,
      pendingQty: Math.max(0, orderedQty - dispatchedQty),
      poValue,
      items: [...itemsBySku.values()],
    });
  }

  return result;
}
