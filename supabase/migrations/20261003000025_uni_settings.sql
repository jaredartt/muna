-- Which Uni week each person is in right now (the Uni block on Home shows that week).
create table if not exists public.uni_settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_week int not null check (current_week between 1 and 99),
  created_at timestamptz not null default now(),
  unique (user_id)
);
alter table public.uni_settings enable row level security;
create policy "household uni settings read" on public.uni_settings for select to authenticated using (household_id = (select private.my_household()));
create policy "own uni settings insert" on public.uni_settings for insert to authenticated with check (household_id = (select private.my_household()) and user_id = (select auth.uid()));
create policy "own uni settings update" on public.uni_settings for update to authenticated using (user_id = (select auth.uid())) with check (household_id = (select private.my_household()) and user_id = (select auth.uid()));
create policy "own uni settings delete" on public.uni_settings for delete to authenticated using (user_id = (select auth.uid()));
alter publication supabase_realtime add table public.uni_settings;
