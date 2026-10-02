-- Already applied to the live project (Supabase migration 'shared_muna_personality').
-- Muna's personality is ONE text shared by everyone in the home (was one per person).
alter table public.households
  add column muna_personality text not null default '' check (length(muna_personality) <= 2000);

-- keep what was already written: take the first non-empty personality found in each home
update public.households h
set muna_personality = coalesce((
  select p.muna_personality
  from public.profiles p
  where p.household_id = h.id and length(trim(p.muna_personality)) > 0
  order by p.created_at asc
  limit 1
), '');

-- any member of the home may change it (the app cannot update households directly)
create or replace function public.set_household_personality(p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  update public.households
  set muna_personality = left(coalesce(p_text, ''), 2000)
  where id = (select private.my_household());
end;
$$;
revoke execute on function public.set_household_personality(text) from public, anon;
grant execute on function public.set_household_personality(text) to authenticated;

-- live updates: when one person saves, the other phone sees it right away
alter publication supabase_realtime add table public.households;
