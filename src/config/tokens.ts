/**
 * Design Tokens for Creative Workspace
 * Restrained, editorial, warm-neutral dark theme.
 * Strictly avoids generic colors, neon AI accents, gradients, and glassmorphism.
 */
export const tokens = {
  colors: {
    background: '#121211',
    foreground: '#EDEDEC',
    surface: {
      default: '#181816',
      hover: '#1F1F1C',
      active: '#262623',
      subtle: '#141413',
    },
    muted: {
      default: '#222220',
      foreground: '#989890',
    },
    border: {
      default: '#262623',
      subtle: '#1D1D1B',
      strong: '#3A3A36',
    },
    accent: {
      default: '#D97706', // Muted amber / terracotta
      foreground: '#FFFFFF',
      hover: '#B45309',
      muted: 'rgba(217, 119, 6, 0.15)',
    },
    danger: {
      default: '#DC2626',
      foreground: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: {
      sans: 'var(--font-sans)',
      display: 'var(--font-display)',
    },
    scale: {
      display: '2.25rem', // 36px
      title: '1.5rem', // 24px
      subtitle: '1.125rem', // 18px
      body: '0.875rem', // 14px
      caption: '0.75rem', // 12px
      tiny: '0.6875rem', // 11px
    },
  },
  spacing: {
    canvasPadding: 32,
    drawerWidth: 320,
    headerHeight: 56,
  },
  radius: {
    none: '0px',
    sm: '4px',
    md: '6px',
    lg: '8px',
    full: '9999px',
  },
  zIndex: {
    canvas: 1,
    canvasItem: 10,
    canvasSelected: 50,
    libraryDrawer: 100,
    header: 200,
    modal: 500,
    toast: 1000,
  },
  transition: {
    fast: '120ms cubic-bezier(0.16, 1, 0.3, 1)',
    normal: '200ms cubic-bezier(0.16, 1, 0.3, 1)',
    slow: '320ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const;
