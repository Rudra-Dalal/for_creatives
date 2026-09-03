import type { Database } from '@/types/database.types';
import type { Reference } from '@/features/references/types';
import type { MoodboardItem } from '@/features/moodboard/types';
import type { DirectionNoteWithReferences } from '@/features/creative-direction/types';

export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export interface SharedProjectBundle {
  project: Project;
  references?: Reference[];
  moodboard_items?: MoodboardItem[];
  direction_notes?: DirectionNoteWithReferences[];
}
