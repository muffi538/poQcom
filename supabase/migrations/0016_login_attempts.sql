-- ============================================================
-- 0016: Login rate limiting.
--
-- Backs a DB-backed lockout in src/app/login/actions.ts — 5 failed
-- attempts for the same email within 15 minutes blocks further tries
-- (regardless of whether the next password would've been correct) for
-- the rest of that window. RLS enabled with no policy — deny-by-default
-- for anon/authenticated, same as every other table since 0014; only
-- the service-role key ever touches this.
-- ============================================================

create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_email_created_at_idx on public.login_attempts(email, created_at desc);

alter table public.login_attempts enable row level security;
