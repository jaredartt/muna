-- Muna's energy now counts per DAY (Berlin time) instead of per month. The column "month" now holds the day.
alter table public.ai_usage rename column month to day;

create or replace function public.add_ai_usage(p_prompt integer, p_output integer)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.ai_usage (user_id, day, prompt_tokens, output_tokens)
  values ((select auth.uid()), (now() at time zone 'Europe/Berlin')::date, greatest(p_prompt, 0), greatest(p_output, 0))
  on conflict (user_id, day) do update
    set prompt_tokens = public.ai_usage.prompt_tokens + excluded.prompt_tokens,
        output_tokens = public.ai_usage.output_tokens + excluded.output_tokens;
end;
$$;

create or replace function public.get_ai_usage()
returns table (used bigint, budget integer, month_start date)
language sql stable security definer set search_path = ''
as $$
  select coalesce(u.prompt_tokens + u.output_tokens, 0)::bigint, p.monthly_token_budget,
         (now() at time zone 'Europe/Berlin')::date
  from public.profiles p
  left join public.ai_usage u on u.user_id = p.id and u.day = (now() at time zone 'Europe/Berlin')::date
  where p.id = (select auth.uid())
$$;
