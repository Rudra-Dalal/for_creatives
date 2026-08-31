import type { Database } from '@/types/database.types';

export type Reference = Database['public']['Tables']['references']['Row'];
export type ReferenceInsert = Database['public']['Tables']['references']['Insert'];
export type ReferenceUpdate = Database['public']['Tables']['references']['Update'];

export interface ReferenceFilter {
  searchQuery: string;
  selectedTag: string | null;
  selectedDomain: string | null;
}
