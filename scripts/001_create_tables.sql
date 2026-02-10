-- ============================================
-- HelpFlow Database Schema
-- ============================================

-- 1. Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('teacher', 'student')),
  classroom_id uuid,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Profiles RLS: users can read all profiles in their classroom, manage their own
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- 2. Classrooms table
create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  join_code text unique not null,
  created_at timestamptz default now()
);

alter table public.classrooms enable row level security;

-- Teachers can manage their own classrooms; students can see classrooms they belong to
create policy "classrooms_select_teacher" on public.classrooms for select using (
  auth.uid() = teacher_id
);
create policy "classrooms_insert_teacher" on public.classrooms for insert with check (
  auth.uid() = teacher_id
);
create policy "classrooms_update_teacher" on public.classrooms for update using (
  auth.uid() = teacher_id
);
create policy "classrooms_delete_teacher" on public.classrooms for delete using (
  auth.uid() = teacher_id
);
-- Students can see their classroom
create policy "classrooms_select_student" on public.classrooms for select using (
  id in (select classroom_id from public.profiles where id = auth.uid())
);

-- Add foreign key for profiles -> classrooms now that both tables exist
alter table public.profiles
  add constraint fk_profiles_classroom
  foreign key (classroom_id) references public.classrooms(id) on delete set null;

-- 3. Lessons table
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  active boolean default true,
  started_at timestamptz default now(),
  ended_at timestamptz,
  created_at timestamptz default now()
);

alter table public.lessons enable row level security;

-- Teacher can manage lessons they own
create policy "lessons_select_teacher" on public.lessons for select using (
  auth.uid() = teacher_id
);
create policy "lessons_insert_teacher" on public.lessons for insert with check (
  auth.uid() = teacher_id
);
create policy "lessons_update_teacher" on public.lessons for update using (
  auth.uid() = teacher_id
);
-- Students can see lessons in their classroom
create policy "lessons_select_student" on public.lessons for select using (
  classroom_id in (select classroom_id from public.profiles where id = auth.uid())
);

-- 4. Help Requests table
create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  student_name text not null,
  status text not null default 'waiting' check (status in ('waiting', 'completed')),
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.help_requests enable row level security;

-- Students can insert their own requests and view requests in their lesson
create policy "help_requests_insert_student" on public.help_requests for insert with check (
  auth.uid() = student_id
);
create policy "help_requests_select_student" on public.help_requests for select using (
  lesson_id in (
    select l.id from public.lessons l
    join public.profiles p on p.classroom_id = l.classroom_id
    where p.id = auth.uid()
  )
);
-- Teachers can view and update requests in their lessons
create policy "help_requests_select_teacher" on public.help_requests for select using (
  lesson_id in (select id from public.lessons where teacher_id = auth.uid())
);
create policy "help_requests_update_teacher" on public.help_requests for update using (
  lesson_id in (select id from public.lessons where teacher_id = auth.uid())
);

-- 5. Lesson Reports table
create table if not exists public.lesson_reports (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  total_requests integer not null default 0,
  average_wait_time integer not null default 0,
  students_helped text[] default '{}',
  students_not_engaged text[] default '{}',
  requests_by_student jsonb default '{}',
  started_at timestamptz not null,
  ended_at timestamptz not null,
  created_at timestamptz default now()
);

alter table public.lesson_reports enable row level security;

-- Teachers can manage their own reports
create policy "lesson_reports_select_teacher" on public.lesson_reports for select using (
  auth.uid() = teacher_id
);
create policy "lesson_reports_insert_teacher" on public.lesson_reports for insert with check (
  auth.uid() = teacher_id
);

-- ============================================
-- Trigger: auto-create profile on signup
-- ============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', 'User'),
    coalesce(new.raw_user_meta_data ->> 'role', 'student')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
