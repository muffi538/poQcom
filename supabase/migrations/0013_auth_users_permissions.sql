-- ============================================================
-- 0013: Simple admin-managed login + per-page access control.
--
-- No Supabase Auth, no self-signup — accounts only ever get created by
-- an admin via the /admin panel. Sessions are plain opaque tokens in
-- app_sessions (not JWTs): revocation is just "delete the row" (or flip
-- is_enabled), which the auth middleware re-checks on every request, so
-- disabling a user takes effect immediately instead of waiting for a
-- token to expire.
--
-- Page access is a flat allow-list per user (user_page_permissions),
-- keyed by a "page key" string (see src/lib/auth/pages.ts) — no
-- roles/hierarchy, matching the "one admin, per-user page checklist"
-- model this was asked for. is_admin is a single boolean escape hatch:
-- an admin bypasses the allow-list entirely and is the only one who can
-- see /admin.
--
-- RLS is enabled but permissive (same convention as every other table
-- in this schema, see 0001) — this app never talks to Supabase from the
-- browser, only from Next.js server code, so the real access boundary
-- is the app's own middleware/session checks, not Postgres RLS.
-- ============================================================

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  is_admin boolean not null default false,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_page_permissions (
  user_id uuid not null references public.app_users(id) on delete cascade,
  page_key text not null,
  primary key (user_id, page_key)
);

create table if not exists public.app_sessions (
  token text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists app_sessions_user_id_idx on public.app_sessions(user_id);

alter table public.app_users enable row level security;
alter table public.user_page_permissions enable row level security;
alter table public.app_sessions enable row level security;

create policy "permissive access" on public.app_users for all using (true) with check (true);
create policy "permissive access" on public.user_page_permissions for all using (true) with check (true);
create policy "permissive access" on public.app_sessions for all using (true) with check (true);
