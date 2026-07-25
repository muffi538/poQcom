-- ============================================================
-- 0012: Optional tag aliases for shared Dispatch/Sales workbooks.
--
-- Both the Dispatch Consignment Checklist and the Product Sales workbook
-- are single shared tabs across every marketplace, matched by comparing
-- a Marketplace/Platform column against marketplaces.name (exact match,
-- case-insensitive). Confirmed against the real workbooks (2026-07-25)
-- while onboarding BigBasket + Amazon Now: neither sheet necessarily
-- tags a marketplace the same way its PO tracker/display name does --
--   - Dispatch workbook tags Amazon Now's rows "Amazon Now (Etrade)".
--   - Sales workbook tags BigBasket's rows "BB Now".
-- A blind exact-name match would silently find zero rows for either,
-- indistinguishable from "genuinely no data yet". These columns let a
-- marketplace declare the alternate tag once; null means "use the name,
-- unchanged" -- zero behavior change for every marketplace that already
-- matches cleanly (Zepto/Blinkit/Instamart/Flipkart Minutes).
-- ============================================================

alter table public.marketplaces
  add column dispatch_tag text,
  add column sales_platform_tag text;
