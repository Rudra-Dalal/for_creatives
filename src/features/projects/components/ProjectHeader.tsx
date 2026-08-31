'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut, ArrowLeft } from 'lucide-react';
import { authService } from '@/features/auth/services/authService';
import type { Project } from '../types';

interface ProjectHeaderProps {
  project?: Project | null;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function ProjectHeader({
  project,
  activeTab = 'references',
  onTabChange,
}: ProjectHeaderProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await authService.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur-none">
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
  );
}
