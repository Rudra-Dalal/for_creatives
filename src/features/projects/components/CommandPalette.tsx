'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Search,
  Bookmark,
  LayoutGrid,
  Compass,
  Plus,
  Type,
  Palette,
  Sparkles,
  Maximize2,
  Trash2,
  ArrowRight,
} from 'lucide-react';

export interface CommandItem {
  id: string;
  category: 'Navigation' | 'Creation' | 'Canvas' | 'Project';
  label: string;
  keywords: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: 'references' | 'moodboard' | 'direction') => void;
  onAddReference?: () => void;
  onOpenTrash?: () => void;
  onAddText?: () => void;
  onAddColor?: () => void;
  onAddIdea?: () => void;
  onZoomToFit?: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onAddReference,
  onOpenTrash,
  onAddText,
  onAddColor,
  onAddIdea,
  onZoomToFit,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Navigation
      {
        id: 'nav-references',
        category: 'Navigation',
        label: 'Go to References',
        keywords: 'references library bookmarks links view list',
        icon: Bookmark,
        action: () => {
          onNavigate('references');
          onClose();
        },
      },
      {
        id: 'nav-moodboard',
        category: 'Navigation',
        label: 'Go to Moodboard Canvas',
        keywords: 'moodboard canvas playground visual board',
        icon: LayoutGrid,
        action: () => {
          onNavigate('moodboard');
          onClose();
        },
      },
      {
        id: 'nav-direction',
        category: 'Navigation',
        label: 'Go to Creative Direction',
        keywords: 'direction notes statements creative decisions links',
        icon: Compass,
        action: () => {
          onNavigate('direction');
          onClose();
        },
      },

      // Creation
      {
        id: 'create-reference',
        category: 'Creation',
        label: 'Add New Reference',
        keywords: 'add new reference link url bookmark web',
        icon: Plus,
        action: () => {
          onClose();
          onAddReference?.();
        },
      },
      {
        id: 'create-idea',
        category: 'Creation',
        label: 'Add Idea to Canvas',
        keywords: 'add idea thought direction card note concept',
        icon: Sparkles,
        action: () => {
          onNavigate('moodboard');
          onClose();
          onAddIdea?.();
        },
      },
      {
        id: 'create-text',
        category: 'Creation',
        label: 'Add Text Note to Canvas',
        keywords: 'add text note typography memo message',
        icon: Type,
        action: () => {
          onNavigate('moodboard');
          onClose();
          onAddText?.();
        },
      },
      {
        id: 'create-color',
        category: 'Creation',
        label: 'Add Color Swatch',
        keywords: 'add color hex palette swatch tint tone',
        icon: Palette,
        action: () => {
          onNavigate('moodboard');
          onClose();
          onAddColor?.();
        },
      },

      // Canvas & Project
      {
        id: 'canvas-zoom-fit',
        category: 'Canvas',
        label: 'Zoom to Fit Canvas',
        keywords: 'zoom fit fit center frame all objects',
        icon: Maximize2,
        shortcut: 'Cmd+0',
        action: () => {
          onNavigate('moodboard');
          onClose();
          onZoomToFit?.();
        },
      },
      {
        id: 'project-trash',
        category: 'Project',
        label: 'Open Trash & Restore',
        keywords: 'trash deleted restore bin items soft delete',
        icon: Trash2,
        action: () => {
          onClose();
          onOpenTrash?.();
        },
      },
    ];

    return list;
  }, [onNavigate, onClose, onAddReference, onOpenTrash, onAddText, onAddColor, onAddIdea, onZoomToFit]);

  // Filter commands by fuzzy keyword matching
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.keywords.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Global shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const active = document.activeElement;
        // Don't intercept if user is actively in a form or textarea unless palette is open
        if (
          !isOpen &&
          (active?.tagName === 'INPUT' ||
            active?.tagName === 'TEXTAREA' ||
            (active as HTMLElement)?.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          setQuery('');
          // Will open via caller or state
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  // Keyboard navigation within palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 gap-0 border-border bg-surface shadow-floating overflow-hidden rounded-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>Quick navigation and creation tools</DialogDescription>
        </DialogHeader>

        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search actions..."
            className="w-full bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
          />
          <kbd className="hidden sm:inline-block rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Commands List */}
        <div className="max-h-[320px] overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No matching commands found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = cmd.icon;

              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-accent/10 text-foreground'
                      : 'text-muted-foreground hover:bg-surface-subtle hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-accent' : 'text-muted-foreground'}`} />
                    <span className="font-medium truncate">{cmd.label}</span>
                    <span className="text-[10px] text-muted-foreground/60 rounded px-1.5 py-0.5 bg-surface-subtle border border-border/40">
                      {cmd.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {cmd.shortcut && (
                      <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    {isSelected && <ArrowRight className="h-3 w-3 text-accent" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface-subtle text-[11px] text-muted-foreground">
          <span>Use ↑ ↓ to navigate, ↵ to select</span>
          <span>Cmd+K</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
