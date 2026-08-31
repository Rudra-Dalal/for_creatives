-- Creative Workspace: Initial Database Schema Migration
-- Migration: 20260831000001_initial_schema.sql

-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. Projects Table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text default '' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. References Table
create table public.references (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  url text not null,
  title text not null,
  thumbnail_url text default '' not null,
  source_domain text default '' not null,
  note text default '' not null,
  tags text[] default '{}'::text[] not null,
  created_at timestamptz default now() not null
);

-- 3. Moodboard Items Table
create table public.moodboard_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  reference_id uuid references public.references(id) on delete set null,
  type text not null check (type in ('reference', 'text')),
  content jsonb default '{}'::jsonb not null,
  x double precision default 0 not null,
  y double precision default 0 not null,
  width double precision default 240 not null,
  height double precision default 240 not null,
  z_index integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 4. Creative Direction Notes Table
create table public.direction_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text default '' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 5. Bidirectional Junction Table (Core Link Requirement)
create table public.direction_reference_links (
  id uuid primary key default gen_random_uuid(),
  direction_note_id uuid references public.direction_notes(id) on delete cascade not null,
  reference_id uuid references public.references(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  constraint unique_direction_reference unique (direction_note_id, reference_id)
);

-- Performance Indexes
create index idx_projects_user_id on public.projects(user_id);
create index idx_references_project_id on public.references(project_id);
create index idx_references_tags on public.references using gin(tags);
create index idx_moodboard_items_project_id on public.moodboard_items(project_id);
create index idx_moodboard_items_reference_id on public.moodboard_items(reference_id);
create index idx_direction_notes_project_id on public.direction_notes(project_id);
create index idx_dir_ref_links_note_id on public.direction_reference_links(direction_note_id);
create index idx_dir_ref_links_ref_id on public.direction_reference_links(reference_id);

-- Automatic updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tr_projects_updated_at before update on public.projects
  for each row execute function public.handle_updated_at();

create trigger tr_moodboard_items_updated_at before update on public.moodboard_items
  for each row execute function public.handle_updated_at();

create trigger tr_direction_notes_updated_at before update on public.direction_notes
  for each row execute function public.handle_updated_at();
