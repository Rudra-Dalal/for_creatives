import { describe, it, expect } from 'vitest';
import {
  filterProjectsByQuery,
  getProjectSearchMatchReason,
} from '../projectSearchUtils';
import type { ProjectWithSearchMetadata } from '../../types';

function createMockProject(
  id: string,
  name: string,
  description: string,
  references: Array<{ id: string; title: string }> = [],
  direction_notes: Array<{ id: string; title: string }> = []
): ProjectWithSearchMetadata {
  return {
    id,
    user_id: 'user-1',
    name,
    description,
    share_token: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    references,
    direction_notes,
  };
}

describe('projectSearchUtils', () => {
  const sampleProjects: ProjectWithSearchMetadata[] = [
    createMockProject(
      'proj-1',
      'Cyberpunk Editorial',
      'Visual aesthetic for sci-fi fashion publication',
      [
        { id: 'ref-1', title: 'Neon Typography Specimen' },
        { id: 'ref-2', title: 'Tokyo Night Photography' },
      ],
      [{ id: 'dir-1', title: 'High-contrast chromatic aberration' }]
    ),
    createMockProject(
      'proj-2',
      'Minimal Architecture Monograph',
      'Brutalist concrete structures in Zurich',
      [{ id: 'ref-3', title: 'Le Corbusier sketches' }],
      [{ id: 'dir-2', title: 'Monochrome grid discipline' }]
    ),
    createMockProject(
      'proj-3',
      'Solaris Rebrand',
      'Clean energy startup brand identity',
      [],
      [{ id: 'dir-3', title: 'Warm yellow and deep charcoal palette' }]
    ),
  ];

  describe('filterProjectsByQuery', () => {
    it('returns all projects when query is empty or whitespace', () => {
      expect(filterProjectsByQuery(sampleProjects, '')).toEqual(sampleProjects);
      expect(filterProjectsByQuery(sampleProjects, '   ')).toEqual(sampleProjects);
    });

    it('returns empty array when project list is empty or invalid', () => {
      expect(filterProjectsByQuery([], 'cyberpunk')).toEqual([]);
      expect(filterProjectsByQuery(null as unknown as ProjectWithSearchMetadata[], 'test')).toEqual(
        []
      );
    });

    it('filters projects by project name (case-insensitive)', () => {
      const results = filterProjectsByQuery(sampleProjects, 'cyberpunk');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('proj-1');

      const upperResults = filterProjectsByQuery(sampleProjects, 'SOLARIS');
      expect(upperResults).toHaveLength(1);
      expect(upperResults[0].id).toBe('proj-3');
    });

    it('filters projects by description substring', () => {
      const results = filterProjectsByQuery(sampleProjects, 'Brutalist concrete');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('proj-2');
    });

    it('filters projects by child reference title', () => {
      const results = filterProjectsByQuery(sampleProjects, 'Tokyo Night');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('proj-1');

      const sketchResults = filterProjectsByQuery(sampleProjects, 'corbusier');
      expect(sketchResults).toHaveLength(1);
      expect(sketchResults[0].id).toBe('proj-2');
    });

    it('filters projects by child creative direction note title', () => {
      const results = filterProjectsByQuery(sampleProjects, 'chromatic aberration');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('proj-1');

      const paletteResults = filterProjectsByQuery(sampleProjects, 'charcoal palette');
      expect(paletteResults).toHaveLength(1);
      expect(paletteResults[0].id).toBe('proj-3');
    });

    it('trims whitespace around search queries', () => {
      const results = filterProjectsByQuery(sampleProjects, '   Minimal Architecture   ');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('proj-2');
    });

    it('safely handles regex special characters without throwing', () => {
      const specialProjects: ProjectWithSearchMetadata[] = [
        createMockProject('proj-spec-1', 'Project [2026] (Final)', 'Version 1.0+'),
        createMockProject('proj-spec-2', 'Brand *Identity* $100', 'Question? Yes!'),
      ];

      expect(() => filterProjectsByQuery(specialProjects, '[2026]')).not.toThrow();
      expect(filterProjectsByQuery(specialProjects, '[2026]')).toHaveLength(1);

      expect(() => filterProjectsByQuery(specialProjects, '1.0+')).not.toThrow();
      expect(filterProjectsByQuery(specialProjects, '1.0+')).toHaveLength(1);

      expect(() => filterProjectsByQuery(specialProjects, '$100')).not.toThrow();
      expect(filterProjectsByQuery(specialProjects, '$100')).toHaveLength(1);

      expect(() => filterProjectsByQuery(specialProjects, '*Identity*')).not.toThrow();
      expect(filterProjectsByQuery(specialProjects, '*Identity*')).toHaveLength(1);
    });

    it('handles projects with null, empty, or undefined fields gracefully', () => {
      const sparseProjects: ProjectWithSearchMetadata[] = [
        {
          id: 'sparse-1',
          user_id: 'u1',
          name: 'Sparse Name',
          description: '',
          share_token: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          references: undefined,
          direction_notes: undefined,
        },
      ];

      expect(() => filterProjectsByQuery(sparseProjects, 'sparse')).not.toThrow();
      expect(filterProjectsByQuery(sparseProjects, 'sparse')).toHaveLength(1);
      expect(filterProjectsByQuery(sparseProjects, 'nonexistent')).toHaveLength(0);
    });
  });

  describe('getProjectSearchMatchReason', () => {
    const project = sampleProjects[0]; // Cyberpunk Editorial

    it('returns null on empty or whitespace query', () => {
      expect(getProjectSearchMatchReason(project, '')).toBeNull();
      expect(getProjectSearchMatchReason(project, '   ')).toBeNull();
    });

    it('identifies name match', () => {
      const reason = getProjectSearchMatchReason(project, 'Cyberpunk');
      expect(reason).not.toBeNull();
      expect(reason?.matchesName).toBe(true);
      expect(reason?.matchesDescription).toBe(false);
      expect(reason?.matchedReference).toBeUndefined();
      expect(reason?.matchedDirectionNote).toBeUndefined();
    });

    it('identifies description match', () => {
      const reason = getProjectSearchMatchReason(project, 'sci-fi fashion');
      expect(reason).not.toBeNull();
      expect(reason?.matchesName).toBe(false);
      expect(reason?.matchesDescription).toBe(true);
    });

    it('identifies child reference match and provides matched title', () => {
      const reason = getProjectSearchMatchReason(project, 'typography specimen');
      expect(reason).not.toBeNull();
      expect(reason?.matchedReference).toBe('Neon Typography Specimen');
    });

    it('identifies child direction note match and provides matched title', () => {
      const reason = getProjectSearchMatchReason(project, 'chromatic');
      expect(reason).not.toBeNull();
      expect(reason?.matchedDirectionNote).toBe('High-contrast chromatic aberration');
    });

    it('returns null when query matches nothing', () => {
      const reason = getProjectSearchMatchReason(project, 'completely unrelated keyword');
      expect(reason).toBeNull();
    });
  });
});
