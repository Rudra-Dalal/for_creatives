'use client';

import React from 'react';
import Link from 'next/link';
import type { Project } from '../types';
import { MoreHorizontal, Trash2, ArrowUpRight, Folder } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProjectCardProps {
  project: Project;
  onDeleteRequest: (project: Project) => void;
}

export function ProjectCard({ project, onDeleteRequest }: ProjectCardProps) {
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(project.updated_at || project.created_at));

  return (
    <div className="group relative flex flex-col justify-between rounded-lg border border-border bg-surface p-5 transition-all duration-200 hover:border-border-strong hover:bg-surface-hover shadow-subtle">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Folder className="h-4 w-4 text-accent/80" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
              Workspace
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground opacity-60 transition-opacity hover:opacity-100 hover:bg-surface-active focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                danger
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRequest(project);
                }}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Link
          href={`/projects/${project.id}`}
          className="mt-3 block focus:outline-none"
        >
          <h3 className="font-display text-lg font-medium text-foreground group-hover:text-accent transition-colors">
            {project.name}
          </h3>
          {project.description ? (
            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
              {project.description}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground/40 italic">
              No description
            </p>
          )}
        </Link>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border-subtle pt-3 text-[11px] text-muted-foreground/80">
        <span>Updated {formattedDate}</span>
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-0.5 text-accent opacity-0 transition-opacity duration-150 group-hover:opacity-100 font-medium"
        >
          Open <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
