import { supabase } from "@/lib/supabase";
import { parseSheetDate } from "@/lib/po/dates";
import { cityFromZeptoLocation, cityFromBlinkitFcName, cityFromInstamartFcName } from "@/lib/po/city";
import { detectHeaderRow, toNumber } from "./parsing";
import { ImportLineItem } from "./types";

export type WorkbookType = "po" | "sales" | "dispatch" | "ean";

export interface FieldMapping {
  ourField: string;
  sheetColumnName: string;
  isRequired: boolean;
}

// Loads column mapping as DATA, not code — this is what makes the
// importer immune to a client reordering/renaming their sheet's columns:
// only these rows need to change, never src/lib/import/*.ts. Throws if a
// marketplace/workbook combination has no mapping configured yet, same
// spirit as the old "column layout hasn't been confirmed" guard — refuse
// to guess rather than silently mis-parse.
export async function loadFieldMappings(marketplaceId: string, workbookType: WorkbookType): Promise<FieldMapping[]> {
  const { data, error } = await supabase
    .from("import_field_mappings")
    .select("our_field, sheet_column_name, is_required")
    .eq("marketplace_id", marketplaceId)
    .eq("workbook_type", workbookType);
  if (error) throw new Error(`Failed to load ${workbookType} column mapping: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      `No ${workbookType} column mapping configured for this marketplace yet — add rows to import_field_mappings ` +
        `(Data Sync > column mapping) before importing.`
    );
  }
  return data.map((row) => ({ ourField: row.our_field, sheetColumnName: row.sheet_column_name, isRequired: row.is_required }));
}

// Detects the header row (by name, never a fixed position) and returns
// every data row re-keyed by SHEET column name — the same shape
// readSheetTab has always produced, just sourced from whichever raw
// rows the caller passed in (Google Sheets CSV export or an uploaded
// workbook, the importer downstream doesn't care which).
export function extractRowsByHeader(rawRows: string[][], mappings: FieldMapping[], label: string): Record<string, string>[] {
  const requiredColumns = mappings.filter((m) => m.isRequired).map((m) => m.sheetColumnName);
  const { headerRowIndex, header } = detectHeaderRow(rawRows, requiredColumns, label);
  return rawRows.slice(headerRowIndex + 1).map((row) => Object.fromEntries(header.map((col, i) => [col, row[i] ?? ""])));
}

// City-derivation is a real lookup/pattern-match transform (FC name →
// city), not a column rename — it stays code, keyed by marketplace name,
// rather than becoming importer-fragile "mapping" data. Only used when a
// marketplace's mapping has no direct "city" field (Zepto/Blinkit/
// Instamart); Flipkart Minutes (and any future marketplace with a real
// City column) maps "city" directly instead and never touches this.
const CITY_DERIVATION_FUNCTIONS: Record<string, (warehouse: string) => string> = {
  Zepto: cityFromZeptoLocation,
  Blinkit: cityFromBlinkitFcName,
  Instamart: cityFromInstamartFcName,
};

// Converts one sheet row (keyed by sheet column name) into the canonical
// ImportLineItem shape (keyed by our_field), using the DB mapping —
// this is the piece that replaces the old hardcoded per-marketplace
// toLineItem switch statement entirely.
export function rowToImportLineItem(
  row: Record<string, string>,
  mappings: FieldMapping[],
  marketplaceName: string
): ImportLineItem {
  const byField = new Map(mappings.map((m) => [m.ourField, m.sheetColumnName]));
  const get = (field: string): string => {
    const col = byField.get(field);
    return col ? row[col] ?? "" : "";
  };

  const warehouse = get("warehouse");
  const cityColumn = byField.get("city");
  const city = cityColumn ? row[cityColumn] ?? "" : (CITY_DERIVATION_FUNCTIONS[marketplaceName]?.(warehouse) ?? "");

  return {
    poNo: get("po_number"),
    warehouse,
    city,
    sku: get("sku"),
    skuDescription: get("sku_description"),
    poRaisedDate: parseSheetDate(get("po_raised_date")),
    expiryDate: parseSheetDate(get("expiry_date")),
    appointmentDate: parseSheetDate(get("appointment_date")),
    dispatchDate: parseSheetDate(get("dispatch_date")),
    orderedQty: toNumber(get("ordered_qty")),
    dispatchedQty: toNumber(get("dispatched_qty")),
    status: get("status"),
    dispatchWarehouse: get("dispatch_warehouse") || undefined,
  };
}
