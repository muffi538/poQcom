import { supabase } from "@/lib/supabase";
import { SalesRow } from "@/lib/sheets/sales";

// The Supabase-backed replacement for src/lib/sheets/sales.ts's old
// fetchSalesRows — same SalesRow[] shape (so buildDemandIndex stays
// unchanged), sourced from sales_records instead of a live Google Sheets
// fetch.
export async function fetchSalesRowsFromSupabase(): Promise<SalesRow[]> {
  const { data, error } = await supabase
    .from("sales_records")
    .select("platform, category, sub_category, master_sku, sku_id, product_name, gmv, units");
  if (error) throw new Error(`Failed to load sales_records: ${error.message}`);

  return (data ?? [])
    .map(
      (row): SalesRow => ({
        platform: row.platform,
        category: row.category ?? "",
        subCategory: row.sub_category ?? "",
        masterSku: row.master_sku,
        skuId: row.sku_id ?? "",
        product: row.product_name ?? "",
        gmv: row.gmv,
        units: row.units,
      })
    )
    .filter((row) => row.masterSku);
}
