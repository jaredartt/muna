-- Uni weeks: the assignments / readings of each study week and how long you plan to spend on each.
-- task_ids = the calendar tasks Muna made for this item when she planned it.
create table if not exists public.uni_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  week int not null check (week between 1 and 99),
  title text not null,
  minutes int not null check (minutes between 5 and 2400),
  done boolean not null default false,
  task_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.uni_items enable row level security;
create policy "household uni read" on public.uni_items for select to authenticated using (household_id = (select private.my_household()));
create policy "own uni insert" on public.uni_items for insert to authenticated with check (household_id = (select private.my_household()) and created_by = (select auth.uid()));
create policy "own uni update" on public.uni_items for update to authenticated using (created_by = (select auth.uid())) with check (household_id = (select private.my_household()) and created_by = (select auth.uid()));
create policy "own uni delete" on public.uni_items for delete to authenticated using (created_by = (select auth.uid()));
alter publication supabase_realtime add table public.uni_items;
