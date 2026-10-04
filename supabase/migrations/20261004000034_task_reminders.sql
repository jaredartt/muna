-- Each task chooses its own reminder: null = no reminder, 0 = at the start time, otherwise that many minutes before.
alter table public.tasks add column if not exists remind_minutes int check (remind_minutes is null or remind_minutes between 0 and 1440);
