-- The day the pack at home was bought (so Muna can tell how fast it is used even for things already open).
alter table public.pantry add column if not exists bought_at date;
