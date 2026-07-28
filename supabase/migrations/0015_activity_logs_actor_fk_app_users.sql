-- ============================================================
-- 0015: Repoint activity_logs.actor_id at app_users, not auth.users.
--
-- The original FK (0001) referenced Supabase's built-in auth.users
-- table, written back when the plan was to eventually use Supabase
-- Auth. This app ended up with its own app_users table instead (see
-- 0013) — auth.users has never had a single row in it, so that FK could
-- never have validly pointed anywhere. Repointing it at app_users(id)
-- is what actually lets logging record who did something.
-- ============================================================

alter table public.activity_logs drop constraint if exists activity_logs_actor_id_fkey;
alter table public.activity_logs
  add constraint activity_logs_actor_id_fkey
  foreign key (actor_id) references public.app_users(id) on delete set null;
