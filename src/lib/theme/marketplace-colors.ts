// Brand identity per marketplace, confirmed by the user. Zepto/Blinkit/
// Instamart are live (v1 scope); the rest are seeded ahead of time so
// adding a marketplace later is a data change, not a design change.
export interface MarketplaceTheme {
  primary: string;
  accent: string;
}

export const MARKETPLACE_THEMES: Record<string, MarketplaceTheme> = {
  Zepto: { primary: "#7E22CE", accent: "#A855F7" },
  Blinkit: { primary: "#FFD400", accent: "#111111" },
  Instamart: { primary: "#FF6B35", accent: "#FF8A65" },
  // Reuses Flipkart's own blue (same parent brand) as a reasonable
  // placeholder — flag if Flipkart Minutes has its own distinct branding
  // to swap in instead.
  "Flipkart Minutes": { primary: "#2874F0", accent: "#4FA3FF" },
  Flipkart: { primary: "#2874F0", accent: "#4FA3FF" },
  Myntra: { primary: "#FF3F6C", accent: "#FF7096" },
  // Confirmed: dark blue (not Amazon's real orange/black branding) —
  // deliberate design-system choice for this dashboard's marketplace
  // color set, not a copy of the marketplace's own brand. Amazon Now
  // reuses the same scheme, same reasoning.
  Amazon: { primary: "#1B3A5C", accent: "#3B5A78" },
  "Amazon Now": { primary: "#1B3A5C", accent: "#3B5A78" },
  // BigBasket's real logo green — a reasonable brand-adjacent pick (same
  // spirit as Myntra/FBF above), not a strict trademark match.
  BigBasket: { primary: "#84C225", accent: "#A8D65C" },
  FBF: { primary: "#00A86B", accent: "#00A86B" },
  "E-Trade": { primary: "#0099FF", accent: "#0099FF" },
};

// Overview / default brand identity.
export const FRIDO_THEME: MarketplaceTheme = { primary: "#FFC700", accent: "#111111" };

export function themeFor(marketplace: string | null): MarketplaceTheme {
  if (!marketplace) return FRIDO_THEME;
  return MARKETPLACE_THEMES[marketplace] ?? FRIDO_THEME;
}
