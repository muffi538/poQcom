// Marketplaces are data, not code — adding a new one should never require a
// code change once the sheet connector supports it. This list seeds the UI
// (nav, dashboard tabs) until marketplaces can be registered from Settings.
//
// BigBasket and Amazon Now added 2026-07-25 (confirmed against their real
// PO sheet tabs in the shared workbook). Both are structurally thinner
// than Zepto/Blinkit/Instamart/Flipkart Minutes -- BigBasket's tab has no
// PO Date/Expiry Date/City columns at all, and neither has an Expiry Date
// column -- so Pending-workflow expiry scoring/city analytics are simply
// unavailable for them (never fabricated), everything else (Delivered
// workflow, dispatch matching, SKU demand analytics) works the same as
// any other marketplace.
export const MARKETPLACES = ["Zepto", "Blinkit", "Instamart", "Flipkart Minutes", "BigBasket", "Amazon Now"] as const;

export type Marketplace = (typeof MARKETPLACES)[number] | (string & {});

// URL-safe slug for a marketplace name — plain `.toLowerCase()` breaks for
// any multi-word name (e.g. "Flipkart Minutes" would leave a literal space
// in the URL path). Used for both generating nav links and matching the
// dynamic route param back to a marketplace name.
export function marketplaceSlug(marketplace: string): string {
  return marketplace.trim().toLowerCase().replace(/\s+/g, "-");
}
