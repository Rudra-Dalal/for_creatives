-- Creative Workspace: Storyboard Canvas Strokes
-- Migration: 20260927000001_storyboard_strokes.sql
--
-- Adds the storyboard_strokes table for canvas-level freehand pen annotations.
-- Strokes are scoped to a project (not a scene or shot) — they live on the
-- infinite Storyboard canvas and may cross scene/shot boundaries.
--
-- Points are stored as a flat JSON number array [x0,y0,x1,y1,...] in Storyboard
-- WORLD coordinates. No bounding-box positional columns are needed because the
-- points themselves encode position. stroke_width is stored in canvas (world) units.
--
-- Owner applies this manually in the Supabase SQL Editor.
-- Do NOT execute automatically.

-- 1. Table
create table public.storyboard_strokes (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  points         jsonb not null,
  stroke_color   text not null,
  stroke_width   double precision not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz default null
);

-- 2. Indexes
-- Active strokes by project (the common read path on canvas load)
create index idx_storyboard_strokes_project_active
  on public.storyboard_strokes(project_id)
  where deleted_at is null;

-- Deleted strokes by project (supports future Trash / restore)
create index idx_storyboard_strokes_project_deleted
  on public.storyboard_strokes(project_id)
  where deleted_at is not null;

-- 3. updated_at trigger (reuses the existing project-wide trigger function)
create trigger tr_storyboard_strokes_updated_at
  before update on public.storyboard_strokes
  for each row execute function public.handle_updated_at();

-- 4. Row Level Security
alter table public.storyboard_strokes enable row level security;

-- SELECT: user may read strokes whose project they own
create policy "Users can view storyboard strokes of their projects"
  on public.storyboard_strokes for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_strokes.project_id
        and projects.user_id = auth.uid()
    )
  );

-- INSERT: user may insert strokes into projects they own
create policy "Users can insert storyboard strokes into their projects"
  on public.storyboard_strokes for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_strokes.project_id
        and projects.user_id = auth.uid()
    )
  );

-- UPDATE: user may update (i.e. soft-delete via deleted_at) their own project strokes
create policy "Users can update storyboard strokes of their projects"
  on public.storyboard_strokes for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_strokes.project_id
        and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_strokes.project_id
        and projects.user_id = auth.uid()
    )
  );

-- DELETE: user may hard-delete strokes from their own projects
-- (soft-delete via UPDATE is the expected V1 path; hard-delete kept for admin use)
create policy "Users can delete storyboard strokes of their projects"
  on public.storyboard_strokes for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_strokes.project_id
        and projects.user_id = auth.uid()
    )
  );
