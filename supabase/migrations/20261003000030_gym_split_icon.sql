-- Each training day of the split (Push, Pull, Legs...) gets its own icon.
alter table public.gym_splits add column if not exists icon text not null default 'IconBarbellFilled';

-- days that already exist get a fitting icon from their name
update public.gym_splits set icon = case
  when name ilike '%push%' then 'IconFlameFilled'
  when name ilike '%pull%' then 'IconAnchor'
  when name ilike '%leg%' or name ilike '%lower%' then 'IconBikeFilled'
  when name ilike '%upper%' then 'IconBoltFilled'
  when name ilike '%full%' then 'IconStarFilled'
  else icon end
where icon = 'IconBarbellFilled';
