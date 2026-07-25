import { supabase } from "@/lib/supabase";
import { loadFieldMappings, extractRowsByHeader } from "./field-mappings";
import { toNumber } from "./parsing";

export interface ImportSalesResult {
  recordsImported: number;
}

// The Sales ingestion pipeline. Works whether the source workbook has
// ONE shared tab covering every marketplace via a Platform column
// (today's real "Product Summary" sheet — pass the same rawRows for
// every marketplace and this filters by Platform internally) or a
// dedicated tab per marketplace (pass that marketplace's own rawRows —
// no "platform" mapping row means no filtering happens, the whole tab
// belongs to that marketplace). Which shape is in play is entirely a
// property of what's configured in import_field_mappings, never
// something this function hardcodes.
export async function importSalesWorkbookRows(params: {
  marketplaceId: string;
  marketplaceName: string;
  rawRows: string[][];
  salesUploadId: string;
  // The sheet's own Platform column tag, when it doesn't literally equal
  // marketplaceName (confirmed real case: the Sales workbook tags
  // BigBasket's rows "BB Now"). Null/undefined means "match
  // marketplaceName directly", unchanged from before this param existed.
  platformTag?: string | null;
}): Promise<ImportSalesResult> {
  const { marketplaceId, marketplaceName, rawRows, salesUploadId } = params;
  const matchTag = params.platformTag ?? marketplaceName;

  const mappings = await loadFieldMappings(marketplaceId, "sales");
  const rowsByHeader = extractRowsByHeader(rawRows, mappings, marketplaceName);

  const byField = new Map(mappings.map((m) => [m.ourField, m.sheetColumnName]));
  const get = (row: Record<string, string>, field: string): string => {
    const col = byField.get(field);
    return col ? row[col] ?? "" : "";
  };

  const hasPlatformMapping = byField.has("platform");
  const relevantRows = hasPlatformMapping
    ? rowsByHeader.filter((row) => get(row, "platform").trim().toLowerCase() === matchTag.trim().toLowerCase())
    : rowsByHeader;

  const records = relevantRows
    .map((row) => ({
      sales_upload_id: salesUploadId,
      marketplace_id: marketplaceId,
      // Always the canonical marketplace name, never the sheet's own raw
      // tag (which may differ, e.g. "BB Now") -- this is what downstream
      // demand/rank.ts matches against, and it must agree with
      // marketplace_id rather than carry a second, possibly-divergent
      // spelling of the same marketplace.
      platform: marketplaceName,
      category: get(row, "category") || null,
      sub_category: get(row, "sub_category") || null,
      master_sku: get(row, "master_sku"),
      sku_id: get(row, "sku_id") || null,
      product_name: get(row, "product_name") || null,
      gmv: toNumber(get(row, "gmv")),
      units: Math.round(toNumber(get(row, "units"))),
      asp: get(row, "asp") ? toNumber(get(row, "asp")) : null,
      spend: get(row, "spend") ? toNumber(get(row, "spend")) : null,
      tacos_pct: get(row, "tacos_pct") ? toNumber(get(row, "tacos_pct")) : null,
    }))
    .filter((r) => r.master_sku); // no join key, nothing to attach this row to

  if (records.length === 0) return { recordsImported: 0 };

  const { error } = await supabase.from("sales_records").insert(records);
  if (error) throw new Error(`Failed to insert sales_records: ${error.message}`);

  console.log(`[${marketplaceName}] Imported ${records.length} sales_records rows.`);
  return { recordsImported: records.length };
}

// Idempotency for sales_records is a whole-batch replace, not a per-row
// upsert: the sheet is always a full snapshot (not incremental), and
// individual raw rows have no natural unique key (duplicate Platform +
// Master SKU rows are legitimate, summed at read time downstream). This
// must run ONCE before importSalesWorkbookRows is called for any
// marketplace in a sync — never per-marketplace, or each call would
// wipe out the marketplace before it.
export async function clearAllSalesRecords(): Promise<void> {
  const { error } = await supabase.from("sales_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`Failed to clear sales_records before re-import: ${error.message}`);
}
