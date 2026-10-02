-- "Buy again" (true, the default) or "one-time purchase" (false). A one-time product is never put on the shopping list as "running low".
alter table public.products add column if not exists rebuy boolean not null default true;
