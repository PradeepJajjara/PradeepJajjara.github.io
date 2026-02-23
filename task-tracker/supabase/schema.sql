-- Task Tracker Supabase schema + RLS
-- Run this in Supabase SQL Editor as project owner.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('daily','weekly')),
  description text not null default '',
  target integer,
  completions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Helpful indexes
create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_tasks_type on public.tasks(type);
create index if not exists idx_tasks_created_at on public.tasks(created_at desc);
create index if not exists idx_profiles_role on public.profiles(role);

-- Keep updated_at fresh on update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_tasks_set_updated_at on public.tasks;
create trigger trg_tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

-- Cleanup older policy versions for idempotent re-run
DROP POLICY IF EXISTS "Profiles: read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admin read all" ON public.profiles;
DROP POLICY IF EXISTS "Tasks: read own" ON public.tasks;
DROP POLICY IF EXISTS "Tasks: insert own" ON public.tasks;
DROP POLICY IF EXISTS "Tasks: update own" ON public.tasks;
DROP POLICY IF EXISTS "Tasks: delete own" ON public.tasks;
DROP POLICY IF EXISTS "Tasks: admin read all" ON public.tasks;
DROP POLICY IF EXISTS "Tasks: admin insert all" ON public.tasks;
DROP POLICY IF EXISTS "Tasks: admin update all" ON public.tasks;
DROP POLICY IF EXISTS "Tasks: admin delete all" ON public.tasks;

-- Profiles policies
create policy "Profiles: read own"
on public.profiles
for select
using (auth.uid() = id);

create policy "Profiles: admin read all"
on public.profiles
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Tasks policies: regular users can CRUD their own rows
create policy "Tasks: read own"
on public.tasks
for select
using (auth.uid() = user_id);

create policy "Tasks: insert own"
on public.tasks
for insert
with check (auth.uid() = user_id);

create policy "Tasks: update own"
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Tasks: delete own"
on public.tasks
for delete
using (auth.uid() = user_id);

-- Tasks policies: admins can CRUD all rows
create policy "Tasks: admin read all"
on public.tasks
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Tasks: admin insert all"
on public.tasks
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Tasks: admin update all"
on public.tasks
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Tasks: admin delete all"
on public.tasks
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
