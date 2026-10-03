-- Gym (splits, exercises, sets you logged, planned sessions, settings), days Muna must skip when planning, and a place to keep the order of things.

-- order of things you can drag (long press)
alter table public.uni_items add column if not exists position int not null default 0;
alter table public.hobbies add column if not exists position int not null default 0;
alter table public.profiles add column if not exists home_layout jsonb;
grant update (home_layout) on public.profiles to authenticated;

-- days you do not want anything planned on (per person and per planner: uni, gym, hobbies)
create table if not exists public.plan_skips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  area text not null check (area in ('uni','gym','hobbies')),
  day date not null,
  created_at timestamptz not null default now(),
  unique (user_id, area, day)
);

-- a training day of your split: Push, Pull, Legs, Full upper...
create table if not exists public.gym_splits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- an exercise inside a split, with its current target: `weight` kg for `goal_reps` reps (one more rep each time it is reached, +step kg after max_reps)
create table if not exists public.gym_exercises (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  split_id uuid not null references public.gym_splits(id) on delete cascade,
  name text not null,
  position int not null default 0,
  sets int not null default 3 check (sets between 1 and 12),
  weight numeric(7,2) not null default 0 check (weight >= 0),
  goal_reps int not null default 8 check (goal_reps between 1 and 100),
  start_reps int not null default 8 check (start_reps between 1 and 100),
  max_reps int not null default 11 check (max_reps between 1 and 100),
  step numeric(5,2) not null default 1 check (step > 0),
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- every set you did
create table if not exists public.gym_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.gym_exercises(id) on delete cascade,
  day date not null,
  set_no int not null default 1,
  weight numeric(7,2) not null default 0,
  reps int not null check (reps between 0 and 200),
  created_at timestamptz not null default now()
);
create index if not exists gym_logs_exercise_idx on public.gym_logs (exercise_id, day);

-- a planned training day (the calendar task Muna made is task_id)
create table if not exists public.gym_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  split_id uuid not null references public.gym_splits(id) on delete cascade,
  task_id uuid,
  day date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists gym_sessions_day_idx on public.gym_sessions (created_by, day);

-- how you like to train
create table if not exists public.gym_settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  per_week int not null default 3 check (per_week between 1 and 7),
  days int[] not null default '{}',
  time_of_day text not null default 'any' check (time_of_day in ('any','morning','afternoon','evening')),
  minutes int not null default 60 check (minutes between 15 and 300),
  next_index int not null default 0 -- which split comes next in the rotation
);

do $$
declare t text;
begin
  foreach t in array array['plan_skips','gym_splits','gym_exercises','gym_logs','gym_sessions','gym_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "household %1$s read" on public.%1$I for select to authenticated using (household_id = (select private.my_household()))', t);
  end loop;
end $$;

-- plan_skips and gym_settings belong to a person (user_id), the rest were made by a person (created_by)
create policy "own plan_skips insert" on public.plan_skips for insert to authenticated with check (household_id = (select private.my_household()) and user_id = (select auth.uid()));
create policy "own plan_skips delete" on public.plan_skips for delete to authenticated using (user_id = (select auth.uid()));
create policy "own gym_settings insert" on public.gym_settings for insert to authenticated with check (household_id = (select private.my_household()) and user_id = (select auth.uid()));
create policy "own gym_settings update" on public.gym_settings for update to authenticated using (user_id = (select auth.uid())) with check (household_id = (select private.my_household()) and user_id = (select auth.uid()));
do $$
declare t text;
begin
  foreach t in array array['gym_splits','gym_exercises','gym_logs','gym_sessions'] loop
    execute format('create policy "own %1$s insert" on public.%1$I for insert to authenticated with check (household_id = (select private.my_household()) and created_by = (select auth.uid()))', t);
    execute format('create policy "own %1$s update" on public.%1$I for update to authenticated using (created_by = (select auth.uid())) with check (household_id = (select private.my_household()) and created_by = (select auth.uid()))', t);
    execute format('create policy "own %1$s delete" on public.%1$I for delete to authenticated using (created_by = (select auth.uid()))', t);
  end loop;
end $$;

alter publication supabase_realtime add table public.plan_skips, public.gym_splits, public.gym_exercises, public.gym_logs, public.gym_sessions, public.gym_settings;
