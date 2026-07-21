// Marketplaces are data, not code — adding a new one should never require a
// code change once the sheet connector supports it. This list seeds the UI
// (nav, dashboard tabs) until marketplaces can be registered from Settings.
export const MARKETPLACES = [
  "Zepto",
  "Blinkit",
  "Instamart",
  "BigBasket",
] as const;

export type Marketplace = (typeof MARKETPLACES)[number] | (string & {});
