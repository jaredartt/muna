-- Applied to Supabase project "muna" (vlatdcjwxbflicomkbnr) on 2026-10-01 via the Supabase connector.
create schema if not exists private;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our home',
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id),
  display_name text not null default '',
  avatar text not null default 'cat',
  theme_pref text not null default 'system' check (theme_pref in ('light','dark','system')),
  muna_personality text not null default '',
  created_at timestamptz not null default now()
);
create index profiles_household_idx on public.profiles(household_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null check (length(title) between 1 and 300),
  notes text not null default '',
  due_date date,
  start_time time,
  end_time time,
  icon text not null default 'checklist',
  color text not null default 'mint',
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_household_date_idx on public.tasks(household_id, due_date);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_user_idx on public.chat_messages(user_id, created_at);

create or replace function private.my_household()
returns uuid language sql stable security definer set search_path = ''
as $$ select household_id from public.profiles where id = (select auth.uid()) $$;
grant usage on schema private to authenticated;
grant execute on function private.my_household() to authenticated;

-- (handle_new_user is replaced in the second migration: allow-list + auto-join)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare hid uuid;
begin
  insert into public.households default values returning id into hid;
  insert into public.profiles (id, household_id, display_name)
  values (new.id, hid, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), ''));
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.join_household(code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare target uuid; old uuid;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  select id into target from public.households where invite_code = lower(trim(code));
  if target is null then raise exception 'invalid invite code'; end if;
  select household_id into old from public.profiles where id = (select auth.uid());
  if old = target then return target; end if;
  update public.profiles set household_id = target where id = (select auth.uid());
  update public.tasks set household_id = target where household_id = old and created_by = (select auth.uid());
  if not exists (select 1 from public.profiles where household_id = old) then
    delete from public.households where id = old;
  end if;
  return target;
end;
$$;
revoke execute on function public.join_household(text) from public, anon;
grant execute on function public.join_household(text) to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.chat_messages enable row level security;

create policy "members read their household" on public.households for select to authenticated using (id = (select private.my_household()));
create policy "read own and household profiles" on public.profiles for select to authenticated using (id = (select auth.uid()) or household_id = (select private.my_household()));
create policy "update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "household tasks read" on public.tasks for select to authenticated using (household_id = (select private.my_household()));
create policy "household tasks insert" on public.tasks for insert to authenticated with check (household_id = (select private.my_household()) and created_by = (select auth.uid()));
create policy "household tasks update" on public.tasks for update to authenticated using (household_id = (select private.my_household())) with check (household_id = (select private.my_household()));
create policy "household tasks delete" on public.tasks for delete to authenticated using (household_id = (select private.my_household()));
create policy "own chat read" on public.chat_messages for select to authenticated using (user_id = (select auth.uid()));
create policy "own chat insert" on public.chat_messages for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own chat delete" on public.chat_messages for delete to authenticated using (user_id = (select auth.uid()));

revoke update on public.profiles from authenticated;
grant update (display_name, avatar, theme_pref, muna_personality) on public.profiles to authenticated;

alter publication supabase_realtime add table public.tasks;
