import { extractSheetId } from "./client";
import { parseCsv } from "./csv";

// Separate Google Sheet from the PO workbook (confirmed approach), read
// the same way — public CSV export, no service account. Single
// "Product Summary" tab, so no gid is needed (Google exports the first/
// only sheet when gid is omitted).
function getConfiguredSalesSheetId(): string | null {
  const raw = process.env.SALES_SHEET_URL;
  return raw ? extractSheetId(raw) : null;
}

export interface SalesRow {
  platform: string;
  category: string;
  subCategory: string;
  masterSku: string;
  skuId: string;
  product: string;
  gmv: number;
  units: number;
}

function num(value: string | undefined): number {
  const n = Number((value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Fetches and parses the raw sales rows, one per (platform, SKU) line as
// they appear in the sheet — duplicates for the same (platform, Master
// SKU) are NOT aggregated here (confirmed: that's the rank index's job,
// see src/lib/demand/rank.ts), so this stays a faithful mirror of the
// sheet.
export async function fetchSalesRows(): Promise<SalesRow[]> {
  const sheetId = getConfiguredSalesSheetId();
  if (!sheetId) {
    throw new Error(
      "Demand Intelligence sales sheet is not configured. Set SALES_SHEET_URL in .env."
    );
  }

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Failed to read the sales sheet: HTTP ${res.status}. Confirm it's shared as "Anyone with the link can view".`
    );
  }

  const text = await res.text();
  const rows = parseCsv(text).map((row) => row.map((cell) => cell.trim()));
  const header = rows[0];
  if (!header) return [];

  return rows.slice(1).map((row) => {
    const get = (col: string) => row[header.indexOf(col)] ?? "";
    return {
      platform: get("Platform"),
      category: get("Category"),
      subCategory: get("Sub-Category"),
      masterSku: get("Master SKU"),
      skuId: get("SKU ID"),
      product: get("Product"),
      gmv: num(get("GMV")),
      units: num(get("Units")),
    } satisfies SalesRow;
  }).filter((row) => row.masterSku);
}
