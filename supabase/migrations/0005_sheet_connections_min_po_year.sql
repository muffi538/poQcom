-- Per-connection PO-Raised-Date floor (mirrors the old hardcoded
-- TabConfig.minPoRaisedYear — Flipkart Minutes only imports 2026+ POs).
-- Config-driven now: any marketplace's sheet can opt in via this column,
-- no code change required.
alter table public.sheet_connections add column min_po_raised_year integer;
