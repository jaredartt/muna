-- Hobbies: what you like to do, how long it takes, which weekdays you prefer. hobby_sessions = the calendar tasks Muna planned for a week.
create table if not exists public.hobbies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  icon text not null default 'IconPaletteFilled',
  color text not null default 'rose',
  minutes int not null default 60 check (minutes between 15 and 600),
  per_week int not null default 1 check (per_week between 1 and 7),
  days int[] not null default '{}', -- preferred weekdays, 0 = Monday ... 6 = Sunday
  time_of_day text not null default 'any' check (time_of_day in ('any','morning','afternoon','evening')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.hobbies enable row level security;
create policy "household hobbies read" on public.hobbies for select to authenticated using (household_id = (select private.my_household()));
create policy "own hobbies insert" on public.hobbies for insert to authenticated with check (household_id = (select private.my_household()) and created_by = (select auth.uid()));
create policy "own hobbies update" on public.hobbies for update to authenticated using (created_by = (select auth.uid())) with check (household_id = (select private.my_household()) and created_by = (select auth.uid()));
create policy "own hobbies delete" on public.hobbies for delete to authenticated using (created_by = (select auth.uid()));
alter publication supabase_realtime add table public.hobbies;

create table if not exists public.hobby_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  hobby_id uuid not null references public.hobbies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  task_id uuid,
  day date not null,
  week_start date not null, -- the Monday of that week
  created_at timestamptz not null default now(),
  unique (hobby_id, day)
);
alter table public.hobby_sessions enable row level security;
create policy "household hobby sessions read" on public.hobby_sessions for select to authenticated using (household_id = (select private.my_household()));
create policy "own hobby sessions insert" on public.hobby_sessions for insert to authenticated with check (household_id = (select private.my_household()) and created_by = (select auth.uid()));
create policy "own hobby sessions update" on public.hobby_sessions for update to authenticated using (created_by = (select auth.uid())) with check (household_id = (select private.my_household()) and created_by = (select auth.uid()));
create policy "own hobby sessions delete" on public.hobby_sessions for delete to authenticated using (created_by = (select auth.uid()));
alter publication supabase_realtime add table public.hobby_sessions;
create index if not exists hobby_sessions_hobby_idx on public.hobby_sessions (hobby_id, week_start);
