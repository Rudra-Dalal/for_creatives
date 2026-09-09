-- supabase/migrations/20260909000001_direction_note_category_order.sql

-- 1. Add category as a nullable constrained text column
alter table public.direction_notes
  add column if not exists category text
    check (category in ('typography', 'color', 'photography', 'motion', 'materials', 'other'))
    default null;

-- 2. Add display_order for manual ordering within a category group
alter table public.direction_notes
  add column if not exists display_order integer default 0 not null;

-- 3. Backfill existing notes with sequential order per project
with ordered as (
  select id,
    row_number() over (partition by project_id order by created_at asc) - 1 as rn
  from public.direction_notes
  where deleted_at is null
)
update public.direction_notes n
set display_order = o.rn
from ordered o
where n.id = o.id;

-- 4. Index for ordered queries
create index if not exists idx_direction_notes_order
  on public.direction_notes(project_id, category, display_order);
