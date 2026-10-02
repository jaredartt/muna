-- Icons that people upload themselves (Profile -> My icons). Shared by everyone in the home, live via realtime.
-- Each icon is a tiny list of SVG shapes (a few KB), already cleaned by the app before saving.
create table if not exists public.custom_icons (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  tags text not null default '' check (char_length(tags) <= 200),
  view_box text not null default '0 0 24 24' check (view_box ~ '^[0-9. -]+$' and char_length(view_box) <= 40),
  root jsonb not null default '{}'::jsonb check (pg_column_size(root) < 1000),
  nodes jsonb not null check (jsonb_typeof(nodes) = 'array' and pg_column_size(nodes) < 40000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists custom_icons_household_idx on public.custom_icons(household_id);

alter table public.custom_icons enable row level security;
create policy "household icons read" on public.custom_icons for select to authenticated
  using (household_id = (select private.my_household()));
create policy "household icons insert" on public.custom_icons for insert to authenticated
  with check (household_id = (select private.my_household()));
create policy "household icons delete" on public.custom_icons for delete to authenticated
  using (household_id = (select private.my_household()));

alter publication supabase_realtime add table public.custom_icons;
