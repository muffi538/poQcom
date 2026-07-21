import { themeFor } from "@/lib/theme/marketplace-colors";

// Scopes --mp-primary / --mp-accent CSS variables to whatever marketplace
// a page belongs to (or the Frido brand identity on Overview/shared
// pages). Plain CSS custom properties on a wrapper div — no client-side
// theme context needed since the marketplace is known at render time.
export function MarketplaceThemeScope({
  marketplace,
  children,
}: {
  marketplace: string | null;
  children: React.ReactNode;
}) {
  const theme = themeFor(marketplace);
  return (
    <div
      style={
        {
          "--mp-primary": theme.primary,
          "--mp-accent": theme.accent,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
