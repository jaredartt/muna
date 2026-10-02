-- Push 2 of Meals: the pantry remembers how fast things are used, so Muna can predict when something runs out.
alter table public.pantry add column if not exists created_at timestamptz not null default now();

-- One row each time something is used up (use) or bought (buy). amount = packs (0.25 = a quarter of a pack).
create table if not exists public.pantry_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null check (kind in ('use', 'buy')),
  amount numeric not null check (amount >= 0 and amount <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists pantry_log_product_idx on public.pantry_log (household_id, product_id, created_at desc);

alter table public.pantry_log enable row level security;
create policy "household pantry_log read" on public.pantry_log for select to authenticated using (household_id = (select private.my_household()));
create policy "household pantry_log insert" on public.pantry_log for insert to authenticated with check (household_id = (select private.my_household()));
create policy "household pantry_log delete" on public.pantry_log for delete to authenticated using (household_id = (select private.my_household()));
alter publication supabase_realtime add table public.pantry_log;
