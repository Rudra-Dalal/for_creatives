-- Creative Workspace: Playground Evolution (Object Types & Canvas Extensions)
-- Migration: 20260831000004_playground_evolution.sql

-- 1. Update moodboard_items type check constraint to support all playground objects
alter table public.moodboard_items drop constraint if exists moodboard_items_type_check;

alter table public.moodboard_items 
  add constraint moodboard_items_type_check 
  check (type in ('reference', 'image', 'text', 'color', 'idea'));
