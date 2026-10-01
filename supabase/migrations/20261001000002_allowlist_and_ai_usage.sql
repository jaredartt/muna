-- Applied to Supabase project "muna" on 2026-10-01.
create table private.allowed_emails (
  email text primary key check (email = lower(email)),
  group_name text not null default 'home'
);
insert into private.allowed_emails (email, group_name) values
  ('jaredartt@gmail.com', 'home'),
  ('limisan98@gmail.com', 'home');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare grp text; hid uuid;
begin
  select group_name into grp from private.allowed_emails where email = lower(new.email);
  if grp is null then raise exception 'This account is not invited to Muna.'; end if;
  select p.household_id into hid
  from public.profiles p
  join auth.users u on u.id = p.id
  join private.allowed_emails a on a.email = lower(u.email)
  where a.group_name = grp
  order by p.created_at asc limit 1;
  if hid is null then insert into public.households default values returning id into hid; end if;
  insert into public.profiles (id, household_id, display_name)
  values (new.id, hid, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), ''));
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter table public.profiles add column monthly_token_budget integer not null default 1000000;

create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  prompt_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (user_id, month)
);
alter table public.ai_usage enable row level security;
create policy "read own usage" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.add_ai_usage(p_prompt integer, p_output integer)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or p_prompt < 0 or p_output < 0 then raise exception 'invalid usage'; end if;
  insert into public.ai_usage (user_id, month, prompt_tokens, output_tokens)
  values ((select auth.uid()), date_trunc('month', now() at time zone 'utc')::date, p_prompt, p_output)
  on conflict (user_id, month) do update
    set prompt_tokens = public.ai_usage.prompt_tokens + excluded.prompt_tokens,
        output_tokens = public.ai_usage.output_tokens + excluded.output_tokens;
end;
$$;
revoke execute on function public.add_ai_usage(integer, integer) from public, anon;
grant execute on function public.add_ai_usage(integer, integer) to authenticated;

create or replace function public.get_ai_usage()
returns table (used bigint, budget integer, month_start date)
language sql stable security definer set search_path = ''
as $$
  select coalesce(u.prompt_tokens + u.output_tokens, 0)::bigint, p.monthly_token_budget,
         date_trunc('month', now() at time zone 'utc')::date
  from public.profiles p
  left join public.ai_usage u on u.user_id = p.id and u.month = date_trunc('month', now() at time zone 'utc')::date
  where p.id = (select auth.uid())
$$;
revoke execute on function public.get_ai_usage() from public, anon;
grant execute on function public.get_ai_usage() to authenticated;
