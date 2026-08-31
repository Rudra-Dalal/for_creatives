-- Creative Workspace: Row Level Security (RLS) & Storage Migration
-- Migration: 20260831000002_rls_and_storage.sql

-- Enable Row Level Security on all tables
alter table public.projects enable row level security;
alter table public."references" enable row level security;
alter table public.moodboard_items enable row level security;
alter table public.direction_notes enable row level security;
alter table public.direction_reference_links enable row level security;

-- 1. Projects RLS Policies
create policy "Users can view their own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can create their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- 2. References RLS Policies
create policy "Users can view references of their projects"
  on public."references" for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = "references".project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can insert references into their projects"
  on public."references" for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = "references".project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can update references of their projects"
  on public."references" for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = "references".project_id
      and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = "references".project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can delete references of their projects"
  on public."references" for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = "references".project_id
      and projects.user_id = auth.uid()
    )
  );

-- 3. Moodboard Items RLS Policies
create policy "Users can view moodboard items of their projects"
  on public.moodboard_items for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = moodboard_items.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can insert moodboard items into their projects"
  on public.moodboard_items for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = moodboard_items.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can update moodboard items of their projects"
  on public.moodboard_items for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = moodboard_items.project_id
      and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = moodboard_items.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can delete moodboard items of their projects"
  on public.moodboard_items for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = moodboard_items.project_id
      and projects.user_id = auth.uid()
    )
  );

-- 4. Creative Direction Notes RLS Policies
create policy "Users can view direction notes of their projects"
  on public.direction_notes for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = direction_notes.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can insert direction notes into their projects"
  on public.direction_notes for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = direction_notes.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can update direction notes of their projects"
  on public.direction_notes for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = direction_notes.project_id
      and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = direction_notes.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can delete direction notes of their projects"
  on public.direction_notes for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = direction_notes.project_id
      and projects.user_id = auth.uid()
    )
  );

-- 5. Direction-Reference Links RLS Policies
create policy "Users can view direction reference links in their projects"
  on public.direction_reference_links for select
  using (
    exists (
      select 1 from public.direction_notes
      join public.projects on projects.id = direction_notes.project_id
      where direction_notes.id = direction_reference_links.direction_note_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can insert direction reference links into their projects"
  on public.direction_reference_links for insert
  with check (
    exists (
      select 1 from public.direction_notes
      join public.projects on projects.id = direction_notes.project_id
      where direction_notes.id = direction_reference_links.direction_note_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can delete direction reference links in their projects"
  on public.direction_reference_links for delete
  using (
    exists (
      select 1 from public.direction_notes
      join public.projects on projects.id = direction_notes.project_id
      where direction_notes.id = direction_reference_links.direction_note_id
      and projects.user_id = auth.uid()
    )
  );

-- 6. Supabase Storage Bucket Configuration
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'thumbnails',
  'thumbnails',
  false,
  1048576, -- 1MB limit per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) on conflict (id) do nothing;

-- Storage Policies for 'thumbnails' bucket
create policy "Users can upload thumbnails to their own projects"
  on storage.objects for insert
  with check (
    bucket_id = 'thumbnails'
    and exists (
      select 1 from public.projects
      where projects.id::text = (storage.foldername(name))[1]
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can view thumbnails from their own projects"
  on storage.objects for select
  using (
    bucket_id = 'thumbnails'
    and exists (
      select 1 from public.projects
      where projects.id::text = (storage.foldername(name))[1]
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can delete thumbnails from their own projects"
  on storage.objects for delete
  using (
    bucket_id = 'thumbnails'
    and exists (
      select 1 from public.projects
      where projects.id::text = (storage.foldername(name))[1]
      and projects.user_id = auth.uid()
    )
  );
