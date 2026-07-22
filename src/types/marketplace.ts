// Marketplaces are data, not code — adding a new one should never require a
// code change once the sheet connector supports it. This list seeds the UI
// (nav, dashboard tabs) until marketplaces can be registered from Settings.
//
// BigBasket is confirmed out of v1 scope: its sheet tab is structured as
// one block per PO with its own SKU line-item sub-table, not a flat
// one-row-per-PO layout like the other three, so it needs its own parser
// before it can be added back.
export const MARKETPLACES = ["Zepto", "Blinkit", "Instamart", "Flipkart Minutes"] as const;

export const MARKETPLACES_COMING_SOON = ["BigBasket"] as const;

export type Marketplace = (typeof MARKETPLACES)[number] | (string & {});

// URL-safe slug for a marketplace name — plain `.toLowerCase()` breaks for
// any multi-word name (e.g. "Flipkart Minutes" would leave a literal space
// in the URL path). Used for both generating nav links and matching the
// dynamic route param back to a marketplace name.
export function marketplaceSlug(marketplace: string): string {
  return marketplace.trim().toLowerCase().replace(/\s+/g, "-");
}
