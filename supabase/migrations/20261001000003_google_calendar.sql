-- Already applied to the live project (Supabase migration 'google_calendar_connection_and_task_sync').
-- Task <-> Google Calendar link columns
alter table public.tasks
  add column google_event_id text,
  add column google_owner uuid references auth.users(id) on delete set null,
  add column sync_google boolean not null default true;

-- Google refresh tokens: readable ONLY by the server (service role). RLS on, no policies, no grants.
create table public.google_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  connected_at timestamptz not null default now()
);
alter table public.google_connections enable row level security;
revoke all on table public.google_connections from anon, authenticated;

create or replace function public.save_google_connection(p_refresh_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or coalesce(length(p_refresh_token), 0) < 10 then
    raise exception 'invalid token';
  end if;
  insert into public.google_connections (user_id, refresh_token)
  values ((select auth.uid()), p_refresh_token)
  on conflict (user_id) do update set refresh_token = excluded.refresh_token, connected_at = now();
end;
$$;
revoke execute on function public.save_google_connection(text) from public, anon;
grant execute on function public.save_google_connection(text) to authenticated;

create or replace function public.disconnect_google()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.google_connections where user_id = (select auth.uid());
$$;
revoke execute on function public.disconnect_google() from public, anon;
grant execute on function public.disconnect_google() to authenticated;

-- who in my home has connected Google Calendar (never exposes tokens)
create or replace function public.get_google_status()
returns table (user_id uuid, connected boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, (g.user_id is not null)
  from public.profiles p
  left join public.google_connections g on g.user_id = p.id
  where p.household_id = (select household_id from public.profiles where id = (select auth.uid()))
$$;
revoke execute on function public.get_google_status() from public, anon;
grant execute on function public.get_google_status() to authenticated;

-- The app may not write the Google link columns (only the server does).
revoke insert, update on public.tasks from authenticated;
grant insert (household_id, created_by, assigned_to, title, notes, due_date, start_time, end_time, icon, color, completed, completed_at, sync_google)
  on public.tasks to authenticated;
grant update (assigned_to, title, notes, due_date, start_time, end_time, icon, color, completed, completed_at, sync_google)
  on public.tasks to authenticated;
