-- Repeating tasks: the repeat rule lives on the task (jsonb), and each tick of a repeat is one row here.
alter table public.tasks add column if not exists repeat jsonb;

create table if not exists public.task_completions (
  task_id uuid not null references public.tasks(id) on delete cascade,
  occ_date date not null,
  household_id uuid not null references public.households(id) on delete cascade,
  completed_by uuid references auth.users(id) on delete set null default auth.uid(),
  completed_at timestamptz not null default now(),
  primary key (task_id, occ_date)
);
create index if not exists task_completions_household_idx on public.task_completions(household_id);

alter table public.task_completions enable row level security;
create policy "household completions read" on public.task_completions for select to authenticated
  using (household_id = (select private.my_household()));
create policy "household completions insert" on public.task_completions for insert to authenticated
  with check (household_id = (select private.my_household()));
create policy "household completions delete" on public.task_completions for delete to authenticated
  using (household_id = (select private.my_household()));

alter publication supabase_realtime add table public.task_completions;
