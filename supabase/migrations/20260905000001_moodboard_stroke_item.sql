-- Creative Workspace: Pen / Scribble Tool Object Type
-- Migration: 20260905000001_moodboard_stroke_item.sql

-- Update moodboard_items type check constraint to include 'stroke'
alter table public.moodboard_items drop constraint if exists moodboard_items_type_check;

alter table public.moodboard_items 
  add constraint moodboard_items_type_check 
  check (type in ('reference', 'image', 'text', 'color', 'idea', 'stroke'));
