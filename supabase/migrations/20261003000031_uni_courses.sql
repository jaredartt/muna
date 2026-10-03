-- Uni courses: every assignment / reading can belong to a course (Math, Art history...). Existing items simply have no course.
create table if not exists public.uni_courses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'sky',
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.uni_courses enable row level security;
create policy "household uni_courses read" on public.uni_courses for select to authenticated using (household_id = (select private.my_household()));
create policy "own uni_courses insert" on public.uni_courses for insert to authenticated with check (household_id = (select private.my_household()) and created_by = (select auth.uid()));
create policy "own uni_courses update" on public.uni_courses for update to authenticated using (created_by = (select auth.uid())) with check (household_id = (select private.my_household()) and created_by = (select auth.uid()));
create policy "own uni_courses delete" on public.uni_courses for delete to authenticated using (created_by = (select auth.uid()));
alter publication supabase_realtime add table public.uni_courses;

-- deleting a course keeps its assignments (they go back to "no course")
alter table public.uni_items add column if not exists course_id uuid references public.uni_courses(id) on delete set null;
