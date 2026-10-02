-- Push 1 of Meals: to-do lists inside tasks, recipes, the meal plan per day, and the pantry (what is at home).
alter table public.tasks add column if not exists checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array');
-- Each person's daily targets, shape {"kcal":0,"protein":0,"carbs":0,"fat":0}
alter table public.profiles add column if not exists targets jsonb;

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text check (code is null or char_length(code) <= 12),
  name text not null check (char_length(name) between 1 and 160),
  slots text[] not null default '{}',
  -- [{ "product_id": uuid|null, "name": "Chicken breast", "unit": "g"|"ml", "amounts": { "<user id>": grams } }]
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  method text not null default '' check (char_length(method) <= 4000),
  storage text not null default '' check (char_length(storage) <= 1000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists recipes_household_code on public.recipes (household_id, code) where code is not null;

create table if not exists public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  plan_date date not null,
  slot text not null check (slot in ('breakfast','lunch','merienda','dinner')),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (household_id, plan_date, slot)
);

-- What is at home. packs = whole packs on hand (the open one included), pct_left = how full the open pack is.
create table if not exists public.pantry (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  packs numeric not null default 0 check (packs >= 0 and packs <= 1000),
  pct_left numeric not null default 100 check (pct_left between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (household_id, product_id)
);

alter table public.recipes enable row level security;
alter table public.meal_plan enable row level security;
alter table public.pantry enable row level security;
do $$
declare t text;
begin
  foreach t in array array['recipes','meal_plan','pantry'] loop
    execute format('create policy "household %1$s read" on public.%1$s for select to authenticated using (household_id = (select private.my_household()))', t);
    execute format('create policy "household %1$s insert" on public.%1$s for insert to authenticated with check (household_id = (select private.my_household()))', t);
    execute format('create policy "household %1$s update" on public.%1$s for update to authenticated using (household_id = (select private.my_household())) with check (household_id = (select private.my_household()))', t);
    execute format('create policy "household %1$s delete" on public.%1$s for delete to authenticated using (household_id = (select private.my_household()))', t);
    execute format('alter publication supabase_realtime add table public.%1$s', t);
  end loop;
end $$;
