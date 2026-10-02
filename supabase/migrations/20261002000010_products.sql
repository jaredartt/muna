-- The household's own product list (food and later household goods). Filled by scanning a barcode (nutrition from Open Food Facts) or typing it in.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  barcode text check (barcode is null or char_length(barcode) between 6 and 20),
  name text not null check (char_length(name) between 1 and 160),
  brand text check (brand is null or char_length(brand) <= 120),
  pack_size text check (pack_size is null or char_length(pack_size) <= 60), -- as printed, e.g. "500 g"
  unit text not null default 'g' check (unit in ('g','ml')), -- what the nutrition numbers are "per 100" of
  kcal_100 numeric check (kcal_100 is null or kcal_100 between 0 and 1000),
  protein_100 numeric check (protein_100 is null or protein_100 between 0 and 100),
  carbs_100 numeric check (carbs_100 is null or carbs_100 between 0 and 100),
  sugar_100 numeric check (sugar_100 is null or sugar_100 between 0 and 100),
  fat_100 numeric check (fat_100 is null or fat_100 between 0 and 100),
  sat_fat_100 numeric check (sat_fat_100 is null or sat_fat_100 between 0 and 100),
  fibre_100 numeric check (fibre_100 is null or fibre_100 between 0 and 100),
  salt_100 numeric check (salt_100 is null or salt_100 between 0 and 100),
  gluten text not null default 'unknown' check (gluten in ('free','contains','unknown')),
  lactose text not null default 'unknown' check (lactose in ('free','contains','unknown')),
  image_url text check (image_url is null or char_length(image_url) <= 500),
  source text not null default 'manual' check (source in ('openfoodfacts','manual')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists products_household_barcode on public.products (household_id, barcode) where barcode is not null;
create index if not exists products_household_name on public.products (household_id, lower(name));
alter table public.products enable row level security;
create policy "household products read" on public.products for select to authenticated
  using (household_id = (select private.my_household()));
create policy "household products insert" on public.products for insert to authenticated
  with check (household_id = (select private.my_household()));
create policy "household products update" on public.products for update to authenticated
  using (household_id = (select private.my_household())) with check (household_id = (select private.my_household()));
create policy "household products delete" on public.products for delete to authenticated
  using (household_id = (select private.my_household()));
alter publication supabase_realtime add table public.products;
