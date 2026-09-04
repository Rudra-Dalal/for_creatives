-- Creative Workspace: Hardened Read-Only Share Link & Storage RLS Migration
-- Migration: 20260901000003_harden_share_link_rls.sql

-- 1. Drop over-permissive table-level policies that allowed unauthenticated project enumeration
drop policy if exists "Anyone can view shared project" on public.projects;
drop policy if exists "Anyone can view shared project references" on public."references";
drop policy if exists "Anyone can view shared project moodboard items" on public.moodboard_items;
drop policy if exists "Anyone can view shared project direction notes" on public.direction_notes;
drop policy if exists "Anyone can view shared project direction links" on public.direction_reference_links;

-- 2. Storage security for shared project thumbnails
-- Drop the over-permissive storage policy that allowed listing thumbnails whenever share_token is not null.
-- RLS policies on storage.objects cannot receive token parameters. Leaving an anon SELECT policy with
-- `share_token is not null` enabled unauthenticated enumeration of shared project folders.
-- By dropping this policy, anonymous users cannot list or query storage.objects via the Storage API.
-- The thumbnails bucket is set to public = true so that specific thumbnail assets (whose unguessable paths
-- are only disclosed to legitimate recipients via get_shared_project_bundle(p_token)) can be rendered
-- directly by the browser without exposing bucket listing to anonymous users.
drop policy if exists "Anyone can view thumbnails of shared projects" on storage.objects;

update storage.buckets
  set public = true
  where id = 'thumbnails';

-- 3. Token-scoped Secure RPC function
-- Fetches project and child data strictly by exact token match, eliminating project enumeration
create or replace function public.get_shared_project_bundle(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project record;
  v_references jsonb;
  v_moodboard_items jsonb;
  v_direction_notes jsonb;
begin
  -- Validate token: must be non-null and not empty string
  if p_token is null or trim(p_token) = '' then
    return null;
  end if;

  -- 1. Fetch exact matching shared project (only non-sensitive fields)
  select id, name, description, share_token, created_at, updated_at
  into v_project
  from public.projects
  where share_token = trim(p_token)
    and share_token is not null;

  -- If no project matches the exact token, return null immediately
  if v_project.id is null then
    return null;
  end if;

  -- 2. Fetch active (non-deleted) references for this specific project
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'project_id', r.project_id,
      'url', r.url,
      'title', r.title,
      'thumbnail_url', r.thumbnail_url,
      'source_domain', r.source_domain,
      'note', r.note,
      'tags', r.tags,
      'created_at', r.created_at
    ) order by r.created_at desc
  ), '[]'::jsonb)
  into v_references
  from public."references" r
  where r.project_id = v_project.id
    and r.deleted_at is null;

  -- 3. Fetch active (non-deleted) moodboard items for this specific project
  -- including joined reference data if referenced
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'project_id', m.project_id,
      'reference_id', m.reference_id,
      'type', m.type,
      'content', m.content,
      'x', m.x,
      'y', m.y,
      'width', m.width,
      'height', m.height,
      'z_index', m.z_index,
      'created_at', m.created_at,
      'updated_at', m.updated_at,
      'references', case
        when ref.id is not null then jsonb_build_object(
          'id', ref.id,
          'project_id', ref.project_id,
          'url', ref.url,
          'title', ref.title,
          'thumbnail_url', ref.thumbnail_url,
          'source_domain', ref.source_domain,
          'note', ref.note,
          'tags', ref.tags,
          'created_at', ref.created_at
        )
        else null
      end
    ) order by m.z_index asc
  ), '[]'::jsonb)
  into v_moodboard_items
  from public.moodboard_items m
  left join public."references" ref on ref.id = m.reference_id and ref.deleted_at is null
  where m.project_id = v_project.id
    and m.deleted_at is null;

  -- 4. Fetch active (non-deleted) direction notes with linked references
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', dn.id,
      'project_id', dn.project_id,
      'title', dn.title,
      'description', dn.description,
      'created_at', dn.created_at,
      'updated_at', dn.updated_at,
      'references', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', lr.id,
            'project_id', lr.project_id,
            'url', lr.url,
            'title', lr.title,
            'thumbnail_url', lr.thumbnail_url,
            'source_domain', lr.source_domain,
            'note', lr.note,
            'tags', lr.tags,
            'created_at', lr.created_at
          ) order by lr.created_at desc
        )
        from public.direction_reference_links drl
        join public."references" lr on lr.id = drl.reference_id
        where drl.direction_note_id = dn.id
          and lr.deleted_at is null
      ), '[]'::jsonb)
    ) order by dn.created_at desc
  ), '[]'::jsonb)
  into v_direction_notes
  from public.direction_notes dn
  where dn.project_id = v_project.id
    and dn.deleted_at is null;

  -- 5. Return assembled bundle
  return jsonb_build_object(
    'project', jsonb_build_object(
      'id', v_project.id,
      'name', v_project.name,
      'description', v_project.description,
      'share_token', v_project.share_token,
      'created_at', v_project.created_at,
      'updated_at', v_project.updated_at
    ),
    'references', v_references,
    'moodboard_items', v_moodboard_items,
    'direction_notes', v_direction_notes
  );
end;
$$;

-- Restrict function execution permissions
revoke all on function public.get_shared_project_bundle(text) from public;
grant execute on function public.get_shared_project_bundle(text) to anon, authenticated, service_role;
