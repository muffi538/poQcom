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
  Amazon: { primary: "#FF9900", accent: "#232F3E" },
  FBF: { primary: "#00A86B", accent: "#00A86B" },
  "E-Trade": { primary: "#0099FF", accent: "#0099FF" },
};

// Overview / default brand identity.
export const FRIDO_THEME: MarketplaceTheme = { primary: "#FFD400", accent: "#111111" };

export function themeFor(marketplace: string | null): MarketplaceTheme {
  if (!marketplace) return FRIDO_THEME;
  return MARKETPLACE_THEMES[marketplace] ?? FRIDO_THEME;
}
