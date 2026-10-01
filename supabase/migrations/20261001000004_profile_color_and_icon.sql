-- Already applied to the live project.
-- Profile colour + Tabler *filled* icon name (e.g. 'IconPawFilled') chosen by each person.
alter table public.profiles
  add column avatar_color text not null default 'peach'
  check (avatar_color in ('mint','peach','lilac','sky','butter','rose'));
alter table public.profiles alter column avatar set default 'IconPawFilled';
grant update (avatar_color) on public.profiles to authenticated;

-- convert the old short avatar names to Tabler filled icon names
update public.profiles set avatar = case avatar
  when 'sun' then 'IconSunFilled' when 'moon' then 'IconMoonFilled' when 'heart' then 'IconHeartFilled'
  when 'star' then 'IconStarFilled' when 'paw' then 'IconPawFilled' when 'flower' then 'IconFlowerFilled'
  when 'cat' then 'IconPawFilled' when 'dog' then 'IconPawFilled' when 'plant' then 'IconFlowerFilled'
  when 'coffee' then 'IconHeartFilled' when 'music' then 'IconHeartFilled' when 'sparkles' then 'IconStarFilled'
  else avatar end
where avatar !~ '^Icon';
