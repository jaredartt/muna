-- Push notifications to phones (iPhone: add Muna to the Home Screen first).
-- push_subscriptions: one row per device that said yes. notify_settings: what each person wants. push_log: what was already sent (so nothing is sent twice).
-- The private VAPID key is NOT in the database or in this repo: it is a secret of the muna-push edge function (VAPID_PRIVATE_KEY).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "own push_subscriptions read" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "own push_subscriptions insert" on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()) and household_id = (select private.my_household()));
create policy "own push_subscriptions update" on public.push_subscriptions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own push_subscriptions delete" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.notify_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  tz text not null default 'Europe/Berlin',
  tasks_on boolean not null default true,
  lead_minutes int not null default 15 check (lead_minutes between 0 and 1440),
  morning_on boolean not null default true,
  morning_at text not null default '08:00' check (morning_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  updated_at timestamptz not null default now()
);
alter table public.notify_settings enable row level security;
create policy "own notify_settings read" on public.notify_settings for select to authenticated using (user_id = (select auth.uid()));
create policy "own notify_settings insert" on public.notify_settings for insert to authenticated with check (user_id = (select auth.uid()) and household_id = (select private.my_household()));
create policy "own notify_settings update" on public.notify_settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  ref text not null,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref, day)
);
alter table public.push_log enable row level security; -- no policies: only the server reads and writes it

revoke all on public.push_log from anon, authenticated;
