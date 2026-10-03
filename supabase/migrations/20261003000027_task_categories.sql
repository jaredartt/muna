-- "Counts for" now has five kinds: task (none), uni, goal, hobby, pantry.
alter table public.tasks drop constraint if exists tasks_category_check;
alter table public.tasks add constraint tasks_category_check check (category is null or category in ('uni', 'goal', 'hobby', 'pantry'));
-- the shopping tasks Muna made are pantry tasks
update public.tasks set category = 'pantry' where title = 'Grocery shopping' and category is null;
