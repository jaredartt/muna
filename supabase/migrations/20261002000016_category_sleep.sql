-- Task category (Uni / Goal) for the Home rings, and the sleep log.
alter table public.tasks add column if not exists category text check (category in ('uni', 'goal'));

-- One row per person per morning. day = the day you woke up. Times are what the person typed in (no placeholders are stored).
create table if not exists public.sleep_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  bed_time time not null,
  wake_time time not null,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
alter table public.sleep_log enable row level security;
create policy "household sleep read" on public.sleep_log for select to authenticated using (household_id = (select private.my_household()));
create policy "own sleep insert" on public.sleep_log for insert to authenticated with check (household_id = (select private.my_household()) and user_id = (select auth.uid()));
create policy "own sleep update" on public.sleep_log for update to authenticated using (user_id = (select auth.uid())) with check (household_id = (select private.my_household()) and user_id = (select auth.uid()));
create policy "own sleep delete" on public.sleep_log for delete to authenticated using (user_id = (select auth.uid()));
alter publication supabase_realtime add table public.sleep_log;
