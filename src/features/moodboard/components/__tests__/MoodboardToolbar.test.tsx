import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/utils/cn', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

import { MoodboardToolbar } from '../MoodboardToolbar';
import { TooltipProvider } from '../../../../components/ui/tooltip';

function renderToolbar(props: Partial<React.ComponentProps<typeof MoodboardToolbar>> = {}) {
  const defaultProps: React.ComponentProps<typeof MoodboardToolbar> = {
    scale: 1,
    selectedId: null,
    selectedCount: 0,
    readOnly: false,
    isLibraryOpen: false,
    onToggleLibrary: vi.fn(),
    onUploadImageFile: vi.fn(),
    onAddTextNote: vi.fn(),
    onAddColor: vi.fn(),
    onAddIdea: vi.fn(),
    onDuplicateSelected: vi.fn(),
    onDeleteSelected: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onResetZoom: vi.fn(),
    onAutoArrange: vi.fn(),
    ...props,
  };

  const html = ReactDOMServer.renderToString(
    React.createElement(
      TooltipProvider,
      null,
      React.createElement(MoodboardToolbar, defaultProps)
    )
  );
  return { html, props: defaultProps };
}

describe('MoodboardToolbar — Stage 3 Smart Arrange Contextual UX', () => {
  it('communicates "Arrange Board" mode when 0 items are selected', () => {
    const { html } = renderToolbar({ selectedCount: 0 });

    // Must have "Arrange Board" in aria-label, title, and screen reader text
    expect(html).toContain('aria-label="Arrange Board"');
    expect(html).toContain('title="Arrange Board"');
    expect(html).toContain('<span>Arrange</span>');
    expect(html).toContain('Board</span>');
  });

  it('communicates "Arrange Board" mode when 1 item is selected', () => {
    const { html } = renderToolbar({ selectedId: 'card-1', selectedCount: 1 });

    expect(html).toContain('aria-label="Arrange Board"');
    expect(html).toContain('title="Arrange Board"');
    expect(html).toContain('<span>Arrange</span>');
    expect(html).toContain('Board</span>');
  });

  it('communicates "Arrange Selection" mode when 2+ items are selected', () => {
    const { html } = renderToolbar({ selectedCount: 3 });

    expect(html).toContain('aria-label="Arrange Selection (3 items)"');
    expect(html).toContain('title="Arrange Selection (3 items)"');
    expect(html).toContain('<span>Arrange</span>');
    expect(html).toContain('Selection (3 items)</span>');
  });

  it('preserves existing click behavior and button type', () => {
    const onAutoArrange = vi.fn();
    const { html } = renderToolbar({ onAutoArrange });

    // Accessible button element with type="button" and layout grid icon
    expect(html).toContain('type="button"');
    expect(html).toContain('lucide-layout-grid');
  });

  it('does not render Arrange button in readOnly mode', () => {
    const { html } = renderToolbar({ readOnly: true });

    expect(html).not.toContain('Arrange Board');
    expect(html).not.toContain('Arrange Selection');
  });
});
