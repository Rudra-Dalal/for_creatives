import type { ProjectWithSearchMetadata } from '../types';

export interface ProjectSearchMatchReason {
  matchesName: boolean;
  matchesDescription: boolean;
  matchedReference?: string;
  matchedDirectionNote?: string;
}

/**
 * Pure utility function to filter a list of projects by a search query.
 * Matches against:
 * 1. Project name
 * 2. Project description
 * 3. Any associated reference title
 * 4. Any associated creative direction note title
 *
 * Case-insensitive, trims query, and is safe against regex special characters.
 */
export function filterProjectsByQuery(
  projects: ProjectWithSearchMetadata[],
  rawQuery: string
): ProjectWithSearchMetadata[] {
  if (!Array.isArray(projects) || projects.length === 0) {
    return [];
  }

  const query = (rawQuery || '').trim().toLowerCase();
  if (!query) {
    return projects;
  }

  return projects.filter((project) => {
    // 1. Match project name
    if (project.name && project.name.toLowerCase().includes(query)) {
      return true;
    }

    // 2. Match project description
    if (project.description && project.description.toLowerCase().includes(query)) {
      return true;
    }

    // 3. Match reference titles
    if (Array.isArray(project.references)) {
      const hasMatchingRef = project.references.some(
        (ref) => ref.title && ref.title.toLowerCase().includes(query)
      );
      if (hasMatchingRef) return true;
    }

    // 4. Match creative direction note titles
    if (Array.isArray(project.direction_notes)) {
      const hasMatchingNote = project.direction_notes.some(
        (note) => note.title && note.title.toLowerCase().includes(query)
      );
      if (hasMatchingNote) return true;
    }

    return false;
  });
}

/**
 * Returns why a project matched a specific search query, useful for surfacing
 * contextual cues (e.g. "Matched reference: Typography poster") on the project card.
 */
export function getProjectSearchMatchReason(
  project: ProjectWithSearchMetadata,
  rawQuery: string
): ProjectSearchMatchReason | null {
  const query = (rawQuery || '').trim().toLowerCase();
  if (!query) return null;

  const matchesName = Boolean(project.name && project.name.toLowerCase().includes(query));
  const matchesDescription = Boolean(
    project.description && project.description.toLowerCase().includes(query)
  );

  let matchedReference: string | undefined;
  if (Array.isArray(project.references)) {
    const foundRef = project.references.find(
      (ref) => ref.title && ref.title.toLowerCase().includes(query)
    );
    if (foundRef) {
      matchedReference = foundRef.title;
    }
  }

  let matchedDirectionNote: string | undefined;
  if (Array.isArray(project.direction_notes)) {
    const foundNote = project.direction_notes.find(
      (note) => note.title && note.title.toLowerCase().includes(query)
    );
    if (foundNote) {
      matchedDirectionNote = foundNote.title;
    }
  }

  if (matchesName || matchesDescription || matchedReference || matchedDirectionNote) {
    return {
      matchesName,
      matchesDescription,
      matchedReference,
      matchedDirectionNote,
    };
  }

  return null;
}
