-- A tick for one day of a Google Calendar event (like task_completions does for Muna tasks).
create table if not exists public.event_done (
  household_id uuid not null references public.households(id) on delete cascade,
  event_key text not null check (char_length(event_key) between 1 and 300),
  day date not null,
  done_by uuid references auth.users(id) on delete set null default auth.uid(),
  done_at timestamptz not null default now(),
  primary key (household_id, event_key, day)
);
alter table public.event_done enable row level security;
create policy "household event done read" on public.event_done for select to authenticated
  using (household_id = (select private.my_household()));
create policy "household event done insert" on public.event_done for insert to authenticated
  with check (household_id = (select private.my_household()));
create policy "household event done delete" on public.event_done for delete to authenticated
  using (household_id = (select private.my_household()));
alter publication supabase_realtime add table public.event_done;
