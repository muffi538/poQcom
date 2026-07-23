// Marketplace/tab config — still used by the Data Sync architecture and
// Settings' legacy env-var status display. The actual PO fetching logic
// that used to live here (fetchPurchaseOrders/fetchAllPurchaseOrders and
// its toLineItem/aggregateLineItems/groupIntoPoBlocks internals) has been
// removed: the dashboard now reads exclusively from Supabase
// (src/lib/data/purchase-orders.ts) and Google Sheets is only ever
// touched at sync time (src/lib/sync/orchestrator.ts, via
// src/lib/import/*), never at render time.

// Flipkart Minutes added alongside Zepto/Blinkit/Instamart (confirmed:
// behaves identically — same status routing, same priority engine, same
// dashboard). BigBasket remains out of scope: its sheet tab is
// structurally different (PO-per-block with SKU line items, not one row
// per PO) and needs its own parser before it can be added back.
export const SUPPORTED_MARKETPLACES = ["Zepto", "Blinkit", "Instamart", "Flipkart Minutes"] as const;
export type SupportedMarketplace = (typeof SUPPORTED_MARKETPLACES)[number];

export interface TabConfig {
  gidEnvKey: string;
  // Set only when this marketplace's data lives in a different workbook
  // than the shared GOOGLE_SHEET_URL (confirmed future-proofing — not
  // every marketplace has to share one sheet). Falls back to the shared
  // sheet when unset.
  sheetUrlEnvKey?: string;
  headerRowIndex: number;
  poNoColumn: string | null;
  minPoRaisedYear?: number;
  autoDetectHeader?: boolean;
  requiredColumns?: string[];
}

// Legacy env-var config, kept only for Settings' historical status card
// (superseded by the Data Sync page's sheet_connections table).
export const TAB_CONFIG: Record<SupportedMarketplace, TabConfig> = {
  Zepto: {
    gidEnvKey: "GOOGLE_SHEET_GID_ZEPTO",
    headerRowIndex: 1,
    poNoColumn: "PO No.",
  },
  Blinkit: {
    gidEnvKey: "GOOGLE_SHEET_GID_BLINKIT",
    headerRowIndex: 2,
    poNoColumn: "PO No",
  },
  Instamart: {
    gidEnvKey: "GOOGLE_SHEET_GID_INSTAMART",
    headerRowIndex: 2,
    poNoColumn: "PO No",
  },
  "Flipkart Minutes": {
    gidEnvKey: "GOOGLE_SHEET_GID_FLIPKART_MINUTES",
    sheetUrlEnvKey: "FLIPKART_MINUTES_SHEET_URL",
    headerRowIndex: 0,
    poNoColumn: "PO number",
    minPoRaisedYear: 2026,
    autoDetectHeader: true,
    requiredColumns: ["Status", "PO number", "PO IssueDate", "Expiry Date", "City", "Location", "Total PO Qty", "FSN"],
  },
};
