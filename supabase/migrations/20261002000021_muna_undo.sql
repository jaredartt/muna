-- The one last change Muna made for each person, so it can be undone even after the app is closed. One row per person: a newer change replaces it,
-- and undoing removes it. "ops" are the steps that put things back (written and run by the muna-chat edge function with the person's own login).
create table if not exists public.muna_undo (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  household_id uuid not null references public.households(id) on delete cascade,
  request text not null default '' check (char_length(request) <= 300), -- what the person asked
  summary text not null check (char_length(summary) between 1 and 400), -- what Muna did, in words
  ops jsonb not null check (jsonb_typeof(ops) = 'array' and pg_column_size(ops) < 400000),
  created_at timestamptz not null default now()
);
alter table public.muna_undo enable row level security;
create policy "own undo read" on public.muna_undo for select to authenticated
  using (user_id = (select auth.uid()) and household_id = (select private.my_household()));
create policy "own undo insert" on public.muna_undo for insert to authenticated
  with check (user_id = (select auth.uid()) and household_id = (select private.my_household()));
create policy "own undo update" on public.muna_undo for update to authenticated
  using (user_id = (select auth.uid()) and household_id = (select private.my_household()))
  with check (user_id = (select auth.uid()) and household_id = (select private.my_household()));
create policy "own undo delete" on public.muna_undo for delete to authenticated
  using (user_id = (select auth.uid()) and household_id = (select private.my_household()));
