-- ============================================================
-- 0014: Deny-by-default RLS — close the fully-permissive policies.
--
-- Every table so far has had a single "permissive access" policy
-- (`using (true) with check (true)`), which — combined with the app
-- shipping its Supabase URL/anon key as NEXT_PUBLIC_* env vars, as
-- Supabase's own docs say is fine for a real production setup — meant
-- anyone holding that anon key could read/write every row in every
-- table directly against Supabase's REST API, completely bypassing the
-- Next.js app (its own auth/permission checks in src/proxy.ts never
-- even run for a direct API call).
--
-- Fix: drop every one of those policies. RLS stays enabled on each
-- table (already was), so with zero policies left, Postgres denies
-- every row to the `anon` and `authenticated` roles by default — no
-- new policy needs to be written, because this app has no per-user
-- Postgres session at all (it isn't using Supabase Auth; see
-- src/lib/auth/*). The app's own server code now runs entirely through
-- Supabase's `service_role` key (see src/lib/supabase.ts), which has
-- BYPASSRLS and is completely unaffected by any of this — server-side
-- reads/writes keep working exactly as before. `anon`/`authenticated`
-- go from "full access" to "zero access", which is the correct default
-- for a table this app deliberately never lets the browser query
-- directly.
-- ============================================================

drop policy if exists "permissive access" on public.marketplaces;
drop policy if exists "permissive access" on public.sync_jobs;
drop policy if exists "permissive access" on public.po_uploads;
drop policy if exists "permissive access" on public.sales_uploads;
drop policy if exists "permissive access" on public.purchase_orders;
drop policy if exists "permissive access" on public.purchase_order_items;
drop policy if exists "permissive access" on public.sales_records;
drop policy if exists "permissive access" on public.priority_rule_groups;
drop policy if exists "permissive access" on public.priority_rules;
drop policy if exists "permissive access" on public.priority_rule_marketplaces;
drop policy if exists "permissive access" on public.priority_scores;
drop policy if exists "permissive access" on public.activity_logs;
drop policy if exists "permissive access" on public.settings;
drop policy if exists "permissive access" on public.import_field_mappings;
drop policy if exists "permissive access" on public.sheet_connections;
drop policy if exists "permissive access" on public.app_users;
drop policy if exists "permissive access" on public.user_page_permissions;
drop policy if exists "permissive access" on public.app_sessions;
