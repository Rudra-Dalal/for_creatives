-- Creative Workspace: Storyboard Freeform Spatial Geometry & Sequence Connections Migration
-- Migration: 20260913000002_storyboard_canvas_geometry.sql

-- 1. Add spatial geometry columns to storyboard_scenes
alter table public.storyboard_scenes
  add column if not exists x double precision default 100 not null,
  add column if not exists y double precision default 100 not null,
  add column if not exists width double precision default 880 not null,
  add column if not exists height double precision default 560 not null;

-- 2. Add spatial geometry columns to storyboard_shots
alter table public.storyboard_shots
  add column if not exists x double precision default 140 not null,
  add column if not exists y double precision default 160 not null,
  add column if not exists width double precision default 280 not null,
  add column if not exists height double precision default 220 not null,
  add column if not exists z_index integer default 0 not null;

-- 3. Dedicated Sequence Connections Table
create table public.storyboard_shot_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  from_shot_id uuid references public.storyboard_shots(id) on delete cascade not null,
  to_shot_id uuid references public.storyboard_shots(id) on delete cascade not null,
  from_anchor text not null default 'right' check (from_anchor in ('top', 'right', 'bottom', 'left')),
  to_anchor text not null default 'left' check (to_anchor in ('top', 'right', 'bottom', 'left')),
  transition_label text not null default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz default null,
  constraint chk_no_self_connection check (from_shot_id <> to_shot_id),
  constraint unique_active_shot_connection unique (from_shot_id, to_shot_id)
);

-- 4. Indexes for storyboard_shot_connections
create index idx_sb_connections_project on public.storyboard_shot_connections(project_id) where deleted_at is null;
create index idx_sb_connections_from on public.storyboard_shot_connections(from_shot_id) where deleted_at is null;
create index idx_sb_connections_to on public.storyboard_shot_connections(to_shot_id) where deleted_at is null;
create index idx_sb_connections_deleted on public.storyboard_shot_connections(project_id) where deleted_at is not null;

-- 5. Trigger for updated_at on storyboard_shot_connections (reuses public.handle_updated_at)
create trigger tr_storyboard_shot_connections_updated_at before update on public.storyboard_shot_connections
  for each row execute function public.handle_updated_at();

-- 6. Row Level Security (RLS) on storyboard_shot_connections
alter table public.storyboard_shot_connections enable row level security;

create policy "Users can view storyboard connections in their projects"
  on public.storyboard_shot_connections for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_shot_connections.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can insert storyboard connections into their projects"
  on public.storyboard_shot_connections for insert
  with check (
    exists (
      select 1 from public.storyboard_shots s1
      join public.storyboard_shots s2 on s2.id = storyboard_shot_connections.to_shot_id
      join public.projects p on p.id = s1.project_id
      where s1.id = storyboard_shot_connections.from_shot_id
      and s1.project_id = storyboard_shot_connections.project_id
      and s2.project_id = storyboard_shot_connections.project_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can update storyboard connections in their projects"
  on public.storyboard_shot_connections for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_shot_connections.project_id
      and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_shot_connections.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can delete storyboard connections in their projects"
  on public.storyboard_shot_connections for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_shot_connections.project_id
      and projects.user_id = auth.uid()
    )
  );
