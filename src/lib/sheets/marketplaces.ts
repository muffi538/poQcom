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
// dashboard). BigBasket + Amazon Now added 2026-07-25 — see the comment
// in src/types/marketplace.ts for what's structurally different about
// their real sheets (no Expiry Date for either; BigBasket also has no
// PO Date/City).
export const SUPPORTED_MARKETPLACES = [
  "Zepto",
  "Blinkit",
  "Instamart",
  "Flipkart Minutes",
  "BigBasket",
  "Amazon Now",
  "E-trade",
] as const;
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
  // BigBasket + Amazon Now sync exclusively through the Data Sync page's
  // Supabase-backed sheet_connections (never these env vars) -- these
  // entries only exist to satisfy the Record type for Settings' legacy
  // status card, which will correctly show them as "not configured" here.
  BigBasket: {
    gidEnvKey: "GOOGLE_SHEET_GID_BIGBASKET",
    headerRowIndex: 1,
    poNoColumn: "PO",
  },
  "Amazon Now": {
    gidEnvKey: "GOOGLE_SHEET_GID_AMAZON_NOW",
    headerRowIndex: 1,
    poNoColumn: "PO Number",
  },
  // E-trade also syncs exclusively through Data Sync's sheet_connections
  // (never this env var) — same reasoning as BigBasket/Amazon Now above.
  "E-trade": {
    gidEnvKey: "GOOGLE_SHEET_GID_ETRADE",
    headerRowIndex: 1,
    poNoColumn: "PO Number",
  },
};
