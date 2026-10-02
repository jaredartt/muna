-- Weather: the home's place (shared by both of you). {"name":"Berlin","country":"Germany","lat":52.52,"lon":13.41}
alter table public.households add column if not exists weather_place jsonb;

create or replace function public.set_household_weather_place(p_place jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  if p_place is not null and (
    jsonb_typeof(p_place) <> 'object'
    or jsonb_typeof(p_place->'lat') <> 'number'
    or jsonb_typeof(p_place->'lon') <> 'number'
    or jsonb_typeof(p_place->'name') <> 'string'
    or (p_place->>'lat')::numeric not between -90 and 90
    or (p_place->>'lon')::numeric not between -180 and 180
  ) then
    raise exception 'bad place';
  end if;
  update public.households
  set weather_place = p_place
  where id = (select private.my_household());
end;
$$;
revoke execute on function public.set_household_weather_place(jsonb) from public, anon;
grant execute on function public.set_household_weather_place(jsonb) to authenticated;
