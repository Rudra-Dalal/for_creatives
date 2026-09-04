import type { MoodboardItem } from '../types';

export type AlignmentType =
  | 'left'
  | 'center-h'
  | 'right'
  | 'top'
  | 'center-v'
  | 'bottom';

export type DistributionType = 'horizontal' | 'vertical';

export interface PositionUpdate {
  id: string;
  x: number;
  y: number;
}

/**
 * Aligns selected items to edges or centers based on their collective bounding box.
 */
export function calculateAlignment(
  items: MoodboardItem[],
  selectedIds: string[],
  alignment: AlignmentType
): PositionUpdate[] {
  const selected = items.filter((i) => selectedIds.includes(i.id));
  if (selected.length < 2) return [];

  const minX = Math.min(...selected.map((i) => i.x));
  const maxX = Math.max(...selected.map((i) => i.x + i.width));
  const minY = Math.min(...selected.map((i) => i.y));
  const maxY = Math.max(...selected.map((i) => i.y + i.height));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return selected.map((item) => {
    let newX = item.x;
    let newY = item.y;

    switch (alignment) {
      case 'left':
        newX = minX;
        break;
      case 'center-h':
        newX = Math.round(centerX - item.width / 2);
        break;
      case 'right':
        newX = maxX - item.width;
        break;
      case 'top':
        newY = minY;
        break;
      case 'center-v':
        newY = Math.round(centerY - item.height / 2);
        break;
      case 'bottom':
        newY = maxY - item.height;
        break;
    }

    return { id: item.id, x: newX, y: newY };
  });
}

/**
 * Distributes selected items with equal spacing between their edges.
 */
export function calculateDistribution(
  items: MoodboardItem[],
  selectedIds: string[],
  direction: DistributionType
): PositionUpdate[] {
  const selected = items.filter((i) => selectedIds.includes(i.id));
  if (selected.length < 3) return [];

  if (direction === 'horizontal') {
    // Sort by horizontal position
    const sorted = [...selected].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const totalSpan = (last.x + last.width) - first.x;
    const totalItemWidths = sorted.reduce((sum, item) => sum + item.width, 0);
    const availableGap = totalSpan - totalItemWidths;
    const gap = Math.max(0, availableGap / (sorted.length - 1));

    let currentX = first.x;
    return sorted.map((item, index) => {
      if (index === 0) {
        currentX += item.width + gap;
        return { id: item.id, x: item.x, y: item.y };
      }
      const x = Math.round(currentX);
      currentX += item.width + gap;
      return { id: item.id, x, y: item.y };
    });
  } else {
    // Sort by vertical position
    const sorted = [...selected].sort((a, b) => a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const totalSpan = (last.y + last.height) - first.y;
    const totalItemHeights = sorted.reduce((sum, item) => sum + item.height, 0);
    const availableGap = totalSpan - totalItemHeights;
    const gap = Math.max(0, availableGap / (sorted.length - 1));

    let currentY = first.y;
    return sorted.map((item, index) => {
      if (index === 0) {
        currentY += item.height + gap;
        return { id: item.id, x: item.x, y: item.y };
      }
      const y = Math.round(currentY);
      currentY += item.height + gap;
      return { id: item.id, x: item.x, y };
    });
  }
}

/**
 * Arranges items into an elegant masonry/multi-column grid preserving their dimensions.
 * Can be applied to selected items or to all canvas items.
 */
export function calculateAutoArrange(
  items: MoodboardItem[],
  targetIds?: string[]
): PositionUpdate[] {
  const targetItems = targetIds && targetIds.length > 0
    ? items.filter((i) => targetIds.includes(i.id))
    : [...items];

  if (targetItems.length === 0) return [];

  // Anchor to top-left of the bounding box of target items
  const startX = Math.min(...targetItems.map((i) => i.x));
  const startY = Math.min(...targetItems.map((i) => i.y));

  // Determine optimal column count based on item count
  const count = targetItems.length;
  const cols = count <= 3 ? count : count <= 8 ? 3 : 4;
  const gap = 28;

  // Track height of each column
  const columnHeights = new Array(cols).fill(0);
  const columnWidths = new Array(cols).fill(0);

  // Compute column widths
  for (let i = 0; i < targetItems.length; i++) {
    const colIdx = i % cols;
    columnWidths[colIdx] = Math.max(columnWidths[colIdx], targetItems[i].width);
  }

  // Calculate column X offsets
  const columnXs = [startX];
  for (let c = 1; c < cols; c++) {
    columnXs[c] = columnXs[c - 1] + columnWidths[c - 1] + gap;
  }

  // Place items by assigning to shortest column
  return targetItems.map((item) => {
    // Find column with minimum height
    let minCol = 0;
    for (let c = 1; c < cols; c++) {
      if (columnHeights[c] < columnHeights[minCol]) {
        minCol = c;
      }
    }

    const x = columnXs[minCol];
    const y = startY + columnHeights[minCol];

    columnHeights[minCol] += item.height + gap;

    return { id: item.id, x, y };
  });
}
