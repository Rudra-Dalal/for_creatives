-- Creative Workspace: Cross-Project Relationship Integrity Security Migration
-- Migration: 20260831000003_cross_project_integrity.sql

-- 1. Prevent Cross-Project Reference Linking in Moodboard Items
drop policy if exists "Users can insert moodboard items into their projects" on public.moodboard_items;
drop policy if exists "Users can update moodboard items of their projects" on public.moodboard_items;

create policy "Users can insert moodboard items into their projects"
  on public.moodboard_items for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = moodboard_items.project_id
      and projects.user_id = auth.uid()
    )
    and (
      moodboard_items.reference_id is null
      or exists (
        select 1 from public."references"
        where "references".id = moodboard_items.reference_id
        and "references".project_id = moodboard_items.project_id
      )
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
    and (
      moodboard_items.reference_id is null
      or exists (
        select 1 from public."references"
        where "references".id = moodboard_items.reference_id
        and "references".project_id = moodboard_items.project_id
      )
    )
  );

-- 2. Prevent Cross-Project Linking in Direction-Reference Links
drop policy if exists "Users can insert direction reference links into their projects" on public.direction_reference_links;

create policy "Users can insert direction reference links into their projects"
  on public.direction_reference_links for insert
  with check (
    exists (
      select 1 from public.direction_notes dn
      join public."references" r on r.id = direction_reference_links.reference_id
      join public.projects p on p.id = dn.project_id
      where dn.id = direction_reference_links.direction_note_id
      and r.project_id = dn.project_id
      and p.user_id = auth.uid()
    )
  );
