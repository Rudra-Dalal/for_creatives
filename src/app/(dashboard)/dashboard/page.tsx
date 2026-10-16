'use client';

import React, { useState } from 'react';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { CreateProjectDialog } from '@/features/projects/components/CreateProjectDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { authService } from '@/features/auth/services/authService';
import { useRouter } from 'next/navigation';
import type { Project } from '@/features/projects/types';
import { Plus, FolderPlus, LogOut, RefreshCw, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function DashboardPage() {
  const router = useRouter();
  const {
    projects,
    filteredProjects,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    refetch,
    createProject,
    deleteProject,
  } = useProjects();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = async () => {
    await authService.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      setProjectToDelete(null);
    } catch {
      // Error handled by hook or service
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-background px-6">
        <div className="flex items-center gap-2">
          <span className="font-display text-base font-medium tracking-tight text-foreground">
            Creative Workspace
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Project</span>
          </Button>

          <div className="h-4 w-px bg-border-subtle" />

          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface hover:text-foreground border border-transparent hover:border-border"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8 max-w-6xl w-full mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
              Projects
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Select a project workspace or create a new one.
            </p>
          </div>

          {!isLoading && !error && projects.length > 0 && (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <Input
                  type="text"
                  placeholder="Search projects, references, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-8 text-xs bg-surface border-border hover:border-border-strong focus:border-accent transition-colors h-9"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    title="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <span className="text-xs text-muted-foreground font-mono whitespace-nowrap hidden sm:inline">
                {filteredProjects.length === projects.length
                  ? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`
                  : `${filteredProjects.length} of ${projects.length}`}
              </span>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-24 flex items-center justify-center">
            <LoadingSpinner label="Loading workspaces..." />
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="py-16 text-center">
            <p className="text-xs text-red-400 mb-3">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Try Again</span>
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && projects.length === 0 && (
          <EmptyState
            icon={<FolderPlus className="h-10 w-10 stroke-[1.25]" />}
            title="No projects yet"
            description="Create your first creative project to start gathering references, building moodboards, and formulating creative direction."
            action={
              <Button
                onClick={() => setIsCreateOpen(true)}
                size="sm"
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create First Project</span>
              </Button>
            }
            className="py-20"
          />
        )}

        {/* No Search Matches */}
        {!isLoading && !error && projects.length > 0 && filteredProjects.length === 0 && (
          <EmptyState
            icon={<Search className="h-10 w-10 stroke-[1.25]" />}
            title="No matching projects"
            description={`No projects found matching "${searchQuery}". Try searching by project name, description, reference title, or direction note.`}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </Button>
            }
            className="py-16"
          />
        )}

        {/* Projects Grid */}
        {!isLoading && !error && filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                searchQuery={searchQuery}
                onDeleteRequest={(p) => setProjectToDelete(p)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      <CreateProjectDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={createProject}
        onProjectCreated={(newProject) => {
          router.push(`/projects/${newProject.id}`);
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={!!projectToDelete}
        onOpenChange={(open) => {
          if (!open) setProjectToDelete(null);
        }}
        title="Delete Project"
        description={`Are you sure you want to delete "${projectToDelete?.name}"? All associated references, moodboard items, and direction notes will be permanently deleted.`}
        confirmLabel="Delete Project"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
