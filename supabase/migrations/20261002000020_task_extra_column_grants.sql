-- The column-level grants of migration 3 were written before the columns repeat (6), checklist (12) and category (16) existed, so the app
-- (role "authenticated") was refused when it tried to save them. Same household-only access as the other task columns (RLS still applies).
grant insert (repeat, checklist, category) on public.tasks to authenticated;
grant update (repeat, checklist, category) on public.tasks to authenticated;
