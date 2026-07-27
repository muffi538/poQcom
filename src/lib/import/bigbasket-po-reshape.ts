// BigBasket's real "Bigbasket" tab (gid 599406639, confirmed 2026-07-27)
// is not a flat table like every other marketplace's PO sheet — it's a
// repeating per-PO block: one anchor row carrying Status (col A) plus PO
// Number/PO Date/Expiry Date as prefixed text in fixed columns (e.g.
// "PO Number:IRA30742110"), a sub-header row, N item rows, then a Total
// row, then the next block's anchor row immediately follows (no blank
// separator between blocks). This reshapes that into the flat row format
// loadFieldMappings/extractRowsByHeader already expect everywhere else,
// so the shared aggregation/upsert pipeline in po-importer.ts needs zero
// BigBasket-specific code — only import_field_mappings rows pointing at
// this header.
export const BIGBASKET_FLAT_HEADER = [
  "Status",
  "PO Number",
  "PO Date",
  "Expiry Date",
  "SKU",
  "Description",
  "Ordered Qty",
  "Dispatched Qty",
  "Location",
  "Appt Date",
];

const MONTH_NUMBERS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

// "01/Dec/2025" -> "12/01/2025" (US-style m/d/yyyy, what parseSheetDate
// already expects everywhere else) — contained here so the shared date
// parser stays untouched and every other marketplace is unaffected.
function ddMonYyyyToMdY(value: string): string {
  const match = value.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{4})$/);
  if (!match) return "";
  const [, day, monAbbr, year] = match;
  const month = MONTH_NUMBERS[monAbbr.toLowerCase()];
  if (!month) return "";
  return `${month}/${day.padStart(2, "0")}/${year}`;
}

function stripLabel(cell: string | undefined, label: string): string {
  const value = (cell ?? "").trim();
  return value.startsWith(label) ? value.slice(label.length).trim() : "";
}

export function reshapeBigBasketPoRows(rawRows: string[][]): string[][] {
  const out: string[][] = [BIGBASKET_FLAT_HEADER];

  let currentStatus = "";
  let currentPoNumber = "";
  let currentPoDate = "";
  let currentExpiryDate = "";
  let inBlock = false;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const col1 = (row[1] ?? "").trim();
    const col4 = (row[4] ?? "").trim();

    if (col1.startsWith("PO Number:")) {
      currentStatus = (row[0] ?? "").trim();
      currentPoNumber = stripLabel(row[1], "PO Number:");
      currentPoDate = ddMonYyyyToMdY(stripLabel(row[4], "PO Date:"));
      currentExpiryDate = ddMonYyyyToMdY(stripLabel(row[9], "PO Expiry date:"));
      inBlock = true;
      continue;
    }

    if (col1 === "S.No") continue; // per-block sub-header row, not data

    if (col4 === "Total") {
      inBlock = false;
      continue;
    }

    if (!inBlock) {
      // Row 0 is the sheet's own title row ("Status,Bigbasket,...") —
      // expected exactly once, at the very top. A genuinely blank row is
      // harmless. Anything else here is unrecognized and worth flagging
      // rather than silently dropping.
      if (i > 0 && row.some((c) => c.trim() !== "")) {
        console.warn(`[BigBasket] Skipping row ${i + 1}: outside any PO block and not a recognized header — ${row.slice(0, 5).join(" | ")}`);
      }
      continue;
    }

    if (!/^\d+$/.test(col1)) {
      console.warn(`[BigBasket] Skipping row ${i + 1} in PO ${currentPoNumber || "(unknown)"}: expected a numeric S.No in column B, got "${col1}".`);
      continue;
    }

    const sku = (row[5] ?? "").trim();
    if (!sku) {
      console.warn(`[BigBasket] Skipping row ${i + 1} in PO ${currentPoNumber || "(unknown)"}: no SKU code in column F.`);
      continue;
    }

    out.push([
      currentStatus,
      currentPoNumber,
      currentPoDate,
      currentExpiryDate,
      sku,
      col4,
      row[8] ?? "", // Quantity (ordered)
      row[26] ?? "", // Dispatched Qty
      row[25] ?? "", // Location
      row[27] ?? "", // Appt Date
    ]);
  }

  return out;
}
