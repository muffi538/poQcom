// Canonical shape for one row of Demand Intelligence sales data — used
// by buildDemandIndex (src/lib/demand/rank.ts) regardless of source.
// The actual fetching logic that used to live here (fetchSalesRows, a
// live Google Sheets CSV fetch) has been removed: the dashboard now
// reads exclusively from Supabase (src/lib/data/sales.ts) and Google
// Sheets is only ever touched at sync time (src/lib/sync/orchestrator.ts,
// via src/lib/import/sales-importer.ts), never at render time.
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
