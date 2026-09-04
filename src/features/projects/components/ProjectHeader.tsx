'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut, ArrowLeft, Trash2, Search, Share2 } from 'lucide-react';
import { authService } from '@/features/auth/services/authService';
import { TrashModal } from './TrashModal';
import type { Project } from '../types';

interface ProjectHeaderProps {
  project?: Project | null;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onItemRestored?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenTrash?: () => void;
  onOpenShare?: () => void;
}

export function ProjectHeader({
  project,
  activeTab = 'references',
  onTabChange,
  onItemRestored,
  onOpenCommandPalette,
  onOpenTrash,
  onOpenShare,
}: ProjectHeaderProps) {
  const router = useRouter();
  const [internalTrashOpen, setInternalTrashOpen] = useState(false);

  const handleSignOut = async () => {
    await authService.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleRestored = () => {
    onItemRestored?.();
    router.refresh();
  };

  const handleOpenTrashClick = () => {
    if (onOpenTrash) {
      onOpenTrash();
    } else {
      setInternalTrashOpen(true);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-background px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>

          {project && (
            <>
              <ChevronRight className="h-3 w-3 text-border-strong" />
              <h1 className="font-display text-sm font-medium text-foreground tracking-tight max-w-[240px] sm:max-w-md truncate">
                {project.name}
              </h1>
            </>
          )}
        </div>

        {onTabChange && (
          <nav className="hidden sm:flex items-center gap-1 rounded-md bg-surface p-1 border border-border">
            <button
              type="button"
              onClick={() => onTabChange('references')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === 'references'
                  ? 'bg-muted text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              References
            </button>
            <button
              type="button"
              onClick={() => onTabChange('moodboard')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === 'moodboard'
                  ? 'bg-muted text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Moodboard
            </button>
            <button
              type="button"
              onClick={() => onTabChange('direction')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === 'direction'
                  ? 'bg-muted text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Creative Direction
            </button>
          </nav>
        )}

        <div className="flex items-center gap-2">
          {project && (
            <>
              {onOpenCommandPalette && (
                <button
                  type="button"
                  onClick={onOpenCommandPalette}
                  className="hidden md:flex items-center gap-2 rounded-md bg-surface px-2.5 py-1 text-xs text-muted-foreground border border-border hover:border-border-strong hover:text-foreground transition-colors"
                  title="Search & Commands (Cmd+K)"
                >
                  <Search className="h-3 w-3 text-muted-foreground" />
                  <span>Search</span>
                  <kbd className="font-mono text-[10px] text-muted-foreground/80 bg-surface-subtle px-1 rounded border border-border/60">
                    ⌘K
                  </kbd>
                </button>
              )}

              {onOpenShare && (
                <button
                  type="button"
                  onClick={onOpenShare}
                  className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface hover:text-foreground border border-transparent hover:border-border"
                  title="Share Project"
                >
                  <Share2 className="h-3.5 w-3.5 text-accent" />
                  <span className="hidden sm:inline">Share</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenTrashClick}
                className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface hover:text-foreground border border-transparent hover:border-border"
                title="Open Trash"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Trash</span>
              </button>
            </>
          )}

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

      {project && !onOpenTrash && (
        <TrashModal
          projectId={project.id}
          isOpen={internalTrashOpen}
          onClose={() => setInternalTrashOpen(false)}
          onItemRestored={handleRestored}
        />
      )}
    </>
  );
}
