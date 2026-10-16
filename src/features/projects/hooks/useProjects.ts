'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { projectService } from '../services/projectService';
import type { Project, ProjectWithSearchMetadata } from '../types';
import type { CreateProjectInput } from '../validation/projectSchema';
import { filterProjectsByQuery } from '../utils/projectSearchUtils';

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithSearchMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch projects');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filteredProjects = useMemo(() => {
    return filterProjectsByQuery(projects, searchQuery);
  }, [projects, searchQuery]);

  const createProject = async (input: CreateProjectInput): Promise<Project> => {
    const newProject = await projectService.createProject(input);
    const withMetadata: ProjectWithSearchMetadata = {
      ...newProject,
      references: [],
      direction_notes: [],
    };
    setProjects((prev) => [withMetadata, ...prev]);
    return newProject;
  };

  const deleteProject = async (id: string): Promise<void> => {
    await projectService.deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return {
    projects,
    filteredProjects,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    refetch: fetchProjects,
    createProject,
    deleteProject,
  };
}

