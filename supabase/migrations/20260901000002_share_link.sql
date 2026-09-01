-- Creative Workspace: Read-Only Share Link & Revocation Migration
-- Migration: 20260901000002_share_link.sql

-- 1. Add share_token column to projects
alter table public.projects
  add column if not exists share_token text default null unique;

-- Index on share_token for fast read-only lookup
create index if not exists idx_projects_share_token
  on public.projects (share_token)
  where share_token is not null;

-- 2. Read-Only RLS Policies for Shared Projects

-- Allow anonymous or authenticated viewers to read project metadata by share_token
create policy "Anyone can view shared project"
  on public.projects for select
  using (share_token is not null);

-- Allow viewers to read references belonging to a shared project
create policy "Anyone can view shared project references"
  on public."references" for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = "references".project_id
      and projects.share_token is not null
    )
  );

-- Allow viewers to read moodboard items belonging to a shared project
create policy "Anyone can view shared project moodboard items"
  on public.moodboard_items for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = moodboard_items.project_id
      and projects.share_token is not null
    )
  );

-- Allow viewers to read direction notes belonging to a shared project
create policy "Anyone can view shared project direction notes"
  on public.direction_notes for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = direction_notes.project_id
      and projects.share_token is not null
    )
  );

-- Allow viewers to read direction reference links belonging to a shared project
create policy "Anyone can view shared project direction links"
  on public.direction_reference_links for select
  using (
    exists (
      select 1 from public.direction_notes
      join public.projects on projects.id = direction_notes.project_id
      where direction_notes.id = direction_reference_links.direction_note_id
      and projects.share_token is not null
    )
  );
