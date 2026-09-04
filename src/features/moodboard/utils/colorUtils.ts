/**
 * Color math and conversion utilities (HSV, RGB, HEX, Alpha)
 */

export interface HSV {
  h: number; // 0 - 360
  s: number; // 0 - 100
  v: number; // 0 - 100
  a: number; // 0 - 1
}

export interface RGB {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
  a: number; // 0 - 1
}

/**
 * Convert HSV to RGB
 */
export function hsvToRgb(h: number, s: number, v: number, a = 1): RGB {
  const normH = ((h % 360) + 360) % 360;
  const normS = Math.max(0, Math.min(100, s)) / 100;
  const normV = Math.max(0, Math.min(100, v)) / 100;

  const c = normV * normS;
  const x = c * (1 - Math.abs(((normH / 60) % 2) - 1));
  const m = normV - c;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (normH >= 0 && normH < 60) {
    rPrime = c;
    gPrime = x;
    bPrime = 0;
  } else if (normH >= 60 && normH < 120) {
    rPrime = x;
    gPrime = c;
    bPrime = 0;
  } else if (normH >= 120 && normH < 180) {
    rPrime = 0;
    gPrime = c;
    bPrime = x;
  } else if (normH >= 180 && normH < 240) {
    rPrime = 0;
    gPrime = x;
    bPrime = c;
  } else if (normH >= 240 && normH < 300) {
    rPrime = x;
    gPrime = 0;
    bPrime = c;
  } else {
    rPrime = c;
    gPrime = 0;
    bPrime = x;
  }

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
    a: Math.max(0, Math.min(1, a)),
  };
}

/**
 * Convert RGB to HSV
 */
export function rgbToHsv(r: number, g: number, b: number, a = 1): HSV {
  const rNorm = Math.max(0, Math.min(255, r)) / 255;
  const gNorm = Math.max(0, Math.min(255, g)) / 255;
  const bNorm = Math.max(0, Math.min(255, b)) / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : Math.round((delta / max) * 100);
  const v = Math.round(max * 100);

  return {
    h,
    s,
    v,
    a: Math.max(0, Math.min(1, a)),
  };
}

/**
 * Convert RGB to HEX string (#RRGGBB)
 */
export function rgbToHex(r: number, g: number, b: number, includeHash = true): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, '0').toUpperCase();
  };
  const prefix = includeHash ? '#' : '';
  return `${prefix}${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert HSV directly to HEX string
 */
export function hsvToHex(h: number, s: number, v: number, includeHash = true): string {
  const rgb = hsvToRgb(h, s, v);
  return rgbToHex(rgb.r, rgb.g, rgb.b, includeHash);
}

/**
 * Parse HEX string to RGB
 */
export function hexToRgb(hex: string): RGB | null {
  const clean = hex.replace(/^#/, '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b, a: 1 };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b, a: 1 };
  }
  if (clean.length === 8) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    const a = parseInt(clean.substring(6, 8), 16) / 255;
    if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null;
    return { r, g, b, a };
  }
  return null;
}

/**
 * Convert HEX string to HSV
 */
export function hexToHsv(hex: string): HSV {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    // Default fallback to amber
    return { h: 36, s: 95, v: 85, a: 1 };
  }
  return rgbToHsv(rgb.r, rgb.g, rgb.b, rgb.a);
}

/**
 * Normalize and validate a HEX input string
 */
export function normalizeHex(input: string): string {
  let clean = input.trim();
  if (!clean.startsWith('#')) {
    clean = '#' + clean;
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
    return clean.toUpperCase();
  }
  if (/^#[0-9A-Fa-f]{3}$/.test(clean)) {
    const r = clean[1];
    const g = clean[2];
    const b = clean[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return clean;
}

/**
 * Tasteful curated color swatches matching the creative workspace dark editorial aesthetic
 */
export const DEFAULT_PRESET_COLORS: string[] = [
  '#EF4444', // Crimson
  '#F87171', // Soft Coral
  '#EA580C', // Rust Terracotta
  '#F97316', // Orange
  '#F59E0B', // Ochre
  '#D97706', // Primary Amber
  '#10B981', // Emerald
  '#059669', // Pine Green
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#0284C7', // Ocean Blue
  '#2563EB', // Cobalt
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#A855F7', // Purple
  '#EC4899', // Fuchsia
  '#F4F4F0', // Warm Off-White
  '#A8A29E', // Warm Sand
  '#64748B', // Muted Slate
  '#181816', // Deep Charcoal
];
