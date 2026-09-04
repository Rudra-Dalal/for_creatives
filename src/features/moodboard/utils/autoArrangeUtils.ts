import type { MoodboardItem } from '../types';

export interface Position {
  x: number;
  y: number;
}

/**
 * Calculates an aesthetically balanced, masonry-style auto-arrange layout
 * for items on the creative moodboard canvas.
 */
export function calculateAutoArrangeLayout(items: MoodboardItem[]): Map<string, Position> {
  const result = new Map<string, Position>();
  if (!items || items.length === 0) return result;

  const count = items.length;
  // Determine optimal column count based on item quantity
  let cols = 3;
  if (count <= 2) cols = count;
  else if (count <= 4) cols = 2;
  else if (count <= 8) cols = 3;
  else cols = 4;

  const gapX = 32;
  const gapY = 32;

  // Calculate typical column width from items, bounded to reasonable limits
  const avgWidth = Math.round(
    items.reduce((sum, item) => sum + (item.width || 280), 0) / count
  );
  const colWidth = Math.max(260, Math.min(340, avgWidth));

  // Find original centroid of all items to keep the organized layout centered where the user is working
  const origCenterX = items.reduce((sum, item) => sum + (item.x + item.width / 2), 0) / count;
  const origCenterY = items.reduce((sum, item) => sum + (item.y + item.height / 2), 0) / count;

  const colHeights = new Array(cols).fill(0);
  const rawPositions: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];

  // Distribute items into columns with shortest height (masonry packing)
  for (const item of items) {
    let shortestCol = 0;
    let minHeight = colHeights[0];

    for (let c = 1; c < cols; c++) {
      if (colHeights[c] < minHeight) {
        minHeight = colHeights[c];
        shortestCol = c;
      }
    }

    const itemWidth = item.width || colWidth;
    const itemHeight = item.height || 220;

    const x = shortestCol * (colWidth + gapX) + Math.max(0, Math.round((colWidth - itemWidth) / 2));
    const y = colHeights[shortestCol];

    rawPositions.push({ id: item.id, x, y, width: itemWidth, height: itemHeight });
    colHeights[shortestCol] += itemHeight + gapY;
  }

  // Calculate bounding box of the packed layout
  const totalWidth = cols * colWidth + (cols - 1) * gapX;
  const totalHeight = Math.max(...colHeights) - gapY;

  // Center around the original center point
  const targetLeft = Math.max(60, Math.round(origCenterX - totalWidth / 2));
  const targetTop = Math.max(60, Math.round(origCenterY - totalHeight / 2));

  for (const raw of rawPositions) {
    result.set(raw.id, {
      x: targetLeft + raw.x,
      y: targetTop + raw.y,
    });
  }

  return result;
}
