-- Creative Workspace: Storyboard Feature V1 Migration
-- Migration: 20260913000001_storyboard_v1.sql

-- 1. Storyboard Scenes Table
create table public.storyboard_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null default 'Scene 1',
  description text not null default '',
  display_order integer not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz default null
);

-- 2. Storyboard Shots Table
create table public.storyboard_shots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  scene_id uuid references public.storyboard_scenes(id) on delete cascade not null,
  shot_number text not null default '',
  title text not null default '',
  description text not null default '',
  dialogue text not null default '',
  aspect_ratio text not null default '16:9' check (aspect_ratio in ('16:9', '9:16', '1:1', '4:3')),
  shot_type text default null check (shot_type is null or shot_type in (
    'extreme_wide', 'wide', 'medium_wide', 'medium', 'medium_close_up',
    'close_up', 'extreme_close_up', 'pov', 'over_the_shoulder', 'aerial', 'other'
  )),
  camera_movement text default null check (camera_movement is null or camera_movement in (
    'static', 'pan', 'tilt', 'dolly', 'zoom', 'tracking', 'handheld', 'crane', 'other'
  )),
  visual_url text not null default '',
  visual_source text not null default 'none' check (visual_source in ('none', 'reference', 'upload', 'sketch')),
  sketch_data jsonb default null,
  display_order integer not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz default null
);

-- 3. Junction: Storyboard Shot <-> Reference Links
create table public.storyboard_shot_references (
  id uuid primary key default gen_random_uuid(),
  shot_id uuid references public.storyboard_shots(id) on delete cascade not null,
  reference_id uuid references public."references"(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  constraint unique_storyboard_shot_reference unique (shot_id, reference_id)
);

-- 4. Junction: Storyboard Shot <-> Creative Direction Links
create table public.storyboard_shot_direction_links (
  id uuid primary key default gen_random_uuid(),
  shot_id uuid references public.storyboard_shots(id) on delete cascade not null,
  direction_note_id uuid references public.direction_notes(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  constraint unique_storyboard_shot_direction unique (shot_id, direction_note_id)
);

-- 5. Performance and Soft-Delete Indexes
create index idx_storyboard_scenes_project_id on public.storyboard_scenes(project_id);
create index idx_storyboard_scenes_active on public.storyboard_scenes(project_id, display_order) where deleted_at is null;
create index idx_storyboard_scenes_deleted on public.storyboard_scenes(project_id) where deleted_at is not null;

create index idx_storyboard_shots_scene_id on public.storyboard_shots(scene_id);
create index idx_storyboard_shots_project_id on public.storyboard_shots(project_id);
create index idx_storyboard_shots_scene_active on public.storyboard_shots(scene_id, display_order) where deleted_at is null;
create index idx_storyboard_shots_project_active on public.storyboard_shots(project_id) where deleted_at is null;
create index idx_storyboard_shots_deleted on public.storyboard_shots(project_id) where deleted_at is not null;

create index idx_sb_shot_refs_shot on public.storyboard_shot_references(shot_id);
create index idx_sb_shot_refs_ref on public.storyboard_shot_references(reference_id);

create index idx_sb_shot_dir_shot on public.storyboard_shot_direction_links(shot_id);
create index idx_sb_shot_dir_dir on public.storyboard_shot_direction_links(direction_note_id);

-- 6. Automatic updated_at Triggers (reuses public.handle_updated_at)
create trigger tr_storyboard_scenes_updated_at before update on public.storyboard_scenes
  for each row execute function public.handle_updated_at();

create trigger tr_storyboard_shots_updated_at before update on public.storyboard_shots
  for each row execute function public.handle_updated_at();

-- 7. Row Level Security (RLS)
alter table public.storyboard_scenes enable row level security;
alter table public.storyboard_shots enable row level security;
alter table public.storyboard_shot_references enable row level security;
alter table public.storyboard_shot_direction_links enable row level security;

-- Storyboard Scenes Policies
create policy "Users can view storyboard scenes of their projects"
  on public.storyboard_scenes for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_scenes.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can insert storyboard scenes into their projects"
  on public.storyboard_scenes for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_scenes.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can update storyboard scenes of their projects"
  on public.storyboard_scenes for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_scenes.project_id
      and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_scenes.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can delete storyboard scenes of their projects"
  on public.storyboard_scenes for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_scenes.project_id
      and projects.user_id = auth.uid()
    )
  );

-- Storyboard Shots Policies (with cross-project scene integrity)
create policy "Users can view storyboard shots of their projects"
  on public.storyboard_shots for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_shots.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can insert storyboard shots into their projects"
  on public.storyboard_shots for insert
  with check (
    exists (
      select 1 from public.storyboard_scenes s
      join public.projects p on p.id = s.project_id
      where s.id = storyboard_shots.scene_id
      and s.project_id = storyboard_shots.project_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can update storyboard shots of their projects"
  on public.storyboard_shots for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_shots.project_id
      and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.storyboard_scenes s
      join public.projects p on p.id = s.project_id
      where s.id = storyboard_shots.scene_id
      and s.project_id = storyboard_shots.project_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can delete storyboard shots of their projects"
  on public.storyboard_shots for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = storyboard_shots.project_id
      and projects.user_id = auth.uid()
    )
  );

-- Storyboard Shot References Policies (with cross-project reference integrity)
create policy "Users can view storyboard shot references in their projects"
  on public.storyboard_shot_references for select
  using (
    exists (
      select 1 from public.storyboard_shots s
      join public.projects p on p.id = s.project_id
      where s.id = storyboard_shot_references.shot_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can insert storyboard shot references into their projects"
  on public.storyboard_shot_references for insert
  with check (
    exists (
      select 1 from public.storyboard_shots s
      join public."references" r on r.id = storyboard_shot_references.reference_id
      join public.projects p on p.id = s.project_id
      where s.id = storyboard_shot_references.shot_id
      and r.project_id = s.project_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can delete storyboard shot references of their projects"
  on public.storyboard_shot_references for delete
  using (
    exists (
      select 1 from public.storyboard_shots s
      join public.projects p on p.id = s.project_id
      where s.id = storyboard_shot_references.shot_id
      and p.user_id = auth.uid()
    )
  );

-- Storyboard Shot Direction Links Policies (with cross-project direction integrity)
create policy "Users can view storyboard shot direction links in their projects"
  on public.storyboard_shot_direction_links for select
  using (
    exists (
      select 1 from public.storyboard_shots s
      join public.projects p on p.id = s.project_id
      where s.id = storyboard_shot_direction_links.shot_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can insert storyboard shot direction links into their projects"
  on public.storyboard_shot_direction_links for insert
  with check (
    exists (
      select 1 from public.storyboard_shots s
      join public.direction_notes dn on dn.id = storyboard_shot_direction_links.direction_note_id
      join public.projects p on p.id = s.project_id
      where s.id = storyboard_shot_direction_links.shot_id
      and dn.project_id = s.project_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can delete storyboard shot direction links of their projects"
  on public.storyboard_shot_direction_links for delete
  using (
    exists (
      select 1 from public.storyboard_shots s
      join public.projects p on p.id = s.project_id
      where s.id = storyboard_shot_direction_links.shot_id
      and p.user_id = auth.uid()
    )
  );
