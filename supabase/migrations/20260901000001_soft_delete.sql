-- Creative Workspace: Soft Deletion Schema Migration
-- Migration: 20260901000001_soft_delete.sql

-- 1. Add deleted_at columns for soft deletion
alter table public."references"
  add column if not exists deleted_at timestamptz default null;

alter table public.moodboard_items
  add column if not exists deleted_at timestamptz default null;

alter table public.direction_notes
  add column if not exists deleted_at timestamptz default null;

-- 2. Performance Indexes for filtering active vs deleted items
create index if not exists idx_references_active 
  on public."references"(project_id) 
  where deleted_at is null;

create index if not exists idx_moodboard_items_active 
  on public.moodboard_items(project_id) 
  where deleted_at is null;

create index if not exists idx_direction_notes_active 
  on public.direction_notes(project_id) 
  where deleted_at is null;

create index if not exists idx_references_deleted 
  on public."references"(project_id) 
  where deleted_at is not null;

create index if not exists idx_moodboard_items_deleted 
  on public.moodboard_items(project_id) 
  where deleted_at is not null;

create index if not exists idx_direction_notes_deleted 
  on public.direction_notes(project_id) 
  where deleted_at is not null;
