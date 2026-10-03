-- A fixed start time for the gym plan ("Muna, put my sessions at 18:30"). Empty = Muna chooses (time_of_day still applies).
alter table public.gym_settings add column if not exists start_at text check (start_at is null or start_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
