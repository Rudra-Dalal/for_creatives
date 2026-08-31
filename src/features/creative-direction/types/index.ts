import type { Database } from '@/types/database.types';
import type { Reference } from '@/features/references/types';

export type DirectionNote = Database['public']['Tables']['direction_notes']['Row'];
export type DirectionNoteInsert = Database['public']['Tables']['direction_notes']['Insert'];
export type DirectionNoteUpdate = Database['public']['Tables']['direction_notes']['Update'];

export type DirectionReferenceLink = Database['public']['Tables']['direction_reference_links']['Row'];
export type DirectionReferenceLinkInsert = Database['public']['Tables']['direction_reference_links']['Insert'];

export interface DirectionNoteWithReferences extends DirectionNote {
  references: Reference[];
}

export interface DirectionLinkSummary {
  directionNote: DirectionNote;
  linkedAt: string;
}
