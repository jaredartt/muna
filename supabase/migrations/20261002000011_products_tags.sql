-- Products: a "traces" value for gluten and lactose, a hormone-disruptor (endocrine) tag, and Open Beauty Facts as a source (perfume, soap, deodorant).
alter table public.products drop constraint if exists products_gluten_check;
alter table public.products drop constraint if exists products_lactose_check;
alter table public.products drop constraint if exists products_source_check;
alter table public.products add constraint products_gluten_check check (gluten in ('free','contains','traces','unknown'));
alter table public.products add constraint products_lactose_check check (lactose in ('free','contains','traces','unknown'));
alter table public.products add constraint products_source_check check (source in ('openfoodfacts','openbeautyfacts','manual'));
alter table public.products add column if not exists edc text not null default 'unknown' check (edc in ('none','possible','unknown'));
alter table public.products add column if not exists edc_note text check (edc_note is null or char_length(edc_note) <= 300);
-- A product that says "laktosefrei" in its name is lactose-free, whatever the milk allergen tag says.
update public.products set lactose = 'free' where lactose <> 'free' and name ~* '(laktose|lactose)[ -]?(frei|free)|ohne laktose';
