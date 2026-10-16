import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { ProjectCard } from '../ProjectCard';
import type { ProjectWithSearchMetadata } from '../../types';

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function createTestProject(overrides: Partial<ProjectWithSearchMetadata> = {}): ProjectWithSearchMetadata {
  return {
    id: 'proj-123',
    user_id: 'user-456',
    name: 'Editorial Campaign',
    description: 'High-fashion seasonal campaign direction',
    share_token: null,
    created_at: '2026-03-01T12:00:00Z',
    updated_at: '2026-03-01T12:00:00Z',
    references: [
      { id: 'ref-1', title: 'Monochrome Film Noir Stills' },
    ],
    direction_notes: [
      { id: 'dir-1', title: 'Serif Headlines and Spatial Bleeds' },
    ],
    ...overrides,
  };
}

describe('ProjectCard', () => {
  it('renders project title and description', () => {
    const project = createTestProject();
    const html = ReactDOMServer.renderToString(
      <ProjectCard project={project} onDeleteRequest={vi.fn()} />
    );

    expect(html).toContain('Editorial Campaign');
    expect(html).toContain('High-fashion seasonal campaign direction');
    expect(html).toContain('Workspace');
  });

  it('renders "No description" fallback when description is missing', () => {
    const project = createTestProject({ description: '' });
    const html = ReactDOMServer.renderToString(
      <ProjectCard project={project} onDeleteRequest={vi.fn()} />
    );

    expect(html).toContain('No description');
  });

  it('does not display search match tags when no search query is provided', () => {
    const project = createTestProject();
    const html = ReactDOMServer.renderToString(
      <ProjectCard project={project} onDeleteRequest={vi.fn()} />
    );

    expect(html).not.toContain('Reference:');
    expect(html).not.toContain('Direction:');
  });

  it('displays contextual matched reference tag when query matches reference title', () => {
    const project = createTestProject();
    const html = ReactDOMServer.renderToString(
      <ProjectCard project={project} searchQuery="Film Noir" onDeleteRequest={vi.fn()} />
    );

    expect(html).toContain('Reference:');
    expect(html).toContain('Monochrome Film Noir Stills');
  });

  it('displays contextual matched direction note tag when query matches direction note title', () => {
    const project = createTestProject();
    const html = ReactDOMServer.renderToString(
      <ProjectCard project={project} searchQuery="Spatial Bleeds" onDeleteRequest={vi.fn()} />
    );

    expect(html).toContain('Direction:');
    expect(html).toContain('Serif Headlines and Spatial Bleeds');
  });
});
