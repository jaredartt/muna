-- Icon + colour chosen for Google Calendar events (they have no icon of their own). Shared by the home, live via realtime.
create table if not exists public.event_styles (
  household_id uuid not null references public.households(id) on delete cascade,
  event_key text not null check (char_length(event_key) between 1 and 300),
  icon text check (icon is null or char_length(icon) <= 80),
  color text check (color is null or color in ('mint','peach','lilac','sky','butter','rose')),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (household_id, event_key)
);
alter table public.event_styles enable row level security;
create policy "household event styles read" on public.event_styles for select to authenticated
  using (household_id = (select private.my_household()));
create policy "household event styles insert" on public.event_styles for insert to authenticated
  with check (household_id = (select private.my_household()));
create policy "household event styles update" on public.event_styles for update to authenticated
  using (household_id = (select private.my_household())) with check (household_id = (select private.my_household()));
create policy "household event styles delete" on public.event_styles for delete to authenticated
  using (household_id = (select private.my_household()));
alter publication supabase_realtime add table public.event_styles;
