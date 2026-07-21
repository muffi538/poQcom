// Marketplaces are data, not code — adding a new one should never require a
// code change once the sheet connector supports it. This list seeds the UI
// (nav, dashboard tabs) until marketplaces can be registered from Settings.
//
// BigBasket is confirmed out of v1 scope: its sheet tab is structured as
// one block per PO with its own SKU line-item sub-table, not a flat
// one-row-per-PO layout like the other three, so it needs its own parser
// before it can be added back.
export const MARKETPLACES = ["Zepto", "Blinkit", "Instamart"] as const;

export const MARKETPLACES_COMING_SOON = ["BigBasket"] as const;

export type Marketplace = (typeof MARKETPLACES)[number] | (string & {});
