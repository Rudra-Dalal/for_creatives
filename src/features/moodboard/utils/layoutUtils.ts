import type { MoodboardItem, ResolvedConnection } from '../types';
import { extractActiveConnections } from '../connectors/connectionResolution';

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

export interface SmartArrangeOptions {
  /** Internal spacing between adjacent items in the same layer/grid. Defaults to 28. */
  intraClusterGap?: number;
  /** Clearance between connected rank layers. Defaults to 56. */
  layerGap?: number;
  /** Breathing room between distinct clusters. Defaults to 140. */
  interClusterGap?: number;
}

interface ArrangedCluster {
  items: MoodboardItem[];
  relativePositions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
  originalCentroid: { x: number; y: number };
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
 * Computes evidence-based importance for an item based on graph and board data:
 * - Connection degree (in-degree + out-degree) is primary evidence.
 * - Hub role (both incoming and outgoing connections) receives bonus weight.
 * - Item type acts as a modest secondary layout hint only when connection degrees are equal.
 */
function computeEvidenceImportance(
  item: MoodboardItem,
  inDegree: Map<string, number>,
  outDegree: Map<string, number>
): number {
  const inDeg = inDegree.get(item.id) || 0;
  const outDeg = outDegree.get(item.id) || 0;
  const totalDeg = inDeg + outDeg;
  const isHub = inDeg > 0 && outDeg > 0;

  // Secondary type hint (only applied as a tie-breaker when degrees match)
  const typeHint =
    item.type === 'idea' || item.type === 'reference' || item.type === 'image' ? 2 : 1;

  return totalDeg * 10 + (isHub ? 5 : 0) + typeHint;
}

/**
 * Calculates edge-to-edge distance between two item bounding boxes.
 */
function computeBoundingBoxDistance(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): number {
  const xDist = Math.max(0, Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width)));
  const yDist = Math.max(0, Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height)));
  return Math.hypot(xDist, yDist);
}

/**
 * Checks if two bounding boxes intersect with an optional padding buffer.
 */
function checkBoundingBoxIntersection(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  pad = 12
): boolean {
  return (
    a.x - pad < b.x + b.width &&
    a.x + a.width + pad > b.x &&
    a.y - pad < b.y + b.height &&
    a.y + a.height + pad > b.y
  );
}

/**
 * Lays out a connected component of items into a directional, readable flow:
 * Sources (In-degree = 0) -> Hubs -> Sinks (Out-degree = 0).
 * Sorts items within layers using predecessor barycenters to minimize crossing lines.
 */
function layoutConnectedCluster(
  clusterItems: MoodboardItem[],
  connections: ResolvedConnection[],
  inDegree: Map<string, number>,
  outDegree: Map<string, number>,
  intraGap = 28,
  layerGap = 56
): ArrangedCluster {
  const clusterItemMap = new Map(clusterItems.map((i) => [i.id, i]));
  const clusterConns = connections.filter(
    (c) => clusterItemMap.has(c.fromId) && clusterItemMap.has(c.targetId)
  );

  // Local in/out degrees within this connected cluster
  const localInDeg = new Map<string, number>();
  const localOut = new Map<string, string[]>();

  for (const item of clusterItems) {
    localInDeg.set(item.id, 0);
    localOut.set(item.id, []);
  }

  for (const c of clusterConns) {
    localInDeg.set(c.targetId, (localInDeg.get(c.targetId) || 0) + 1);
    localOut.get(c.fromId)!.push(c.targetId);
  }

  // 1. Identify root sources (in-degree == 0). If none (cyclic), select highest out-degree
  let roots = clusterItems.filter((i) => (localInDeg.get(i.id) || 0) === 0);
  if (roots.length === 0) {
    const sortedByOut = [...clusterItems].sort((a, b) => {
      const diff = (localOut.get(b.id)?.length || 0) - (localOut.get(a.id)?.length || 0);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });
    roots = [sortedByOut[0]];
  }

  // 2. Assign topological rank layers (longest path to ensure downstream nodes stay forward)
  const rankMap = new Map<string, number>();
  for (const r of roots) {
    rankMap.set(r.id, 0);
  }

  const queue = [...roots.map((r) => r.id)];
  const inQueue = new Set(queue);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    inQueue.delete(currId);
    const currRank = rankMap.get(currId) || 0;
    const targets = localOut.get(currId) || [];

    for (const tId of targets) {
      const existingRank = rankMap.get(tId);
      const nextRank = currRank + 1;
      // Cycle guard: rank cannot exceed total item count
      if ((existingRank === undefined || nextRank > existingRank) && nextRank < clusterItems.length) {
        rankMap.set(tId, nextRank);
        if (!inQueue.has(tId)) {
          queue.push(tId);
          inQueue.add(tId);
        }
      }
    }
  }

  // Ensure all items receive a rank
  for (const item of clusterItems) {
    if (!rankMap.has(item.id)) {
      rankMap.set(item.id, 0);
    }
  }

  // Group items by rank: Map<rank, MoodboardItem[]>
  const layers = new Map<number, MoodboardItem[]>();
  for (const item of clusterItems) {
    const r = rankMap.get(item.id) || 0;
    if (!layers.has(r)) layers.set(r, []);
    layers.get(r)!.push(item);
  }

  const sortedRanks = Array.from(layers.keys()).sort((a, b) => a - b);

  // 3. Sort nodes within each layer to minimize edge crossings (barycenter heuristic)
  for (const r of sortedRanks) {
    const layerNodes = layers.get(r)!;
    layerNodes.sort((a, b) => {
      const predsA = clusterConns.filter((c) => c.targetId === a.id).map((c) => c.fromId);
      const predsB = clusterConns.filter((c) => c.targetId === b.id).map((c) => c.fromId);

      const avgYA = predsA.length > 0
        ? predsA.reduce((sum, id) => sum + (clusterItemMap.get(id)?.y || 0), 0) / predsA.length
        : a.y;
      const avgYB = predsB.length > 0
        ? predsB.reduce((sum, id) => sum + (clusterItemMap.get(id)?.y || 0), 0) / predsB.length
        : b.y;

      if (avgYA !== avgYB) return avgYA - avgYB;

      // Secondary tie-breaker: evidence importance
      const impDiff =
        computeEvidenceImportance(b, inDegree, outDegree) -
        computeEvidenceImportance(a, inDegree, outDegree);
      if (impDiff !== 0) return impDiff;
      if (a.y !== b.y) return a.y - b.y;
      return a.id.localeCompare(b.id);
    });
  }

  // 4. Compute column widths and layer heights
  const colWidths = new Map<number, number>();
  const layerHeights = new Map<number, number>();

  for (const r of sortedRanks) {
    const nodes = layers.get(r)!;
    const maxW = Math.max(...nodes.map((n) => n.width));
    const totalH = nodes.reduce((sum, n) => sum + n.height, 0) + (nodes.length - 1) * intraGap;
    colWidths.set(r, maxW);
    layerHeights.set(r, totalH);
  }

  const maxLayerH = Math.max(...Array.from(layerHeights.values()), 1);

  // 5. Position nodes with vertical centering relative to max layer height
  const relativePositions = new Map<string, { x: number; y: number }>();
  let currentX = 0;

  for (const r of sortedRanks) {
    const nodes = layers.get(r)!;
    const colW = colWidths.get(r)!;
    const layerH = layerHeights.get(r)!;

    let currentY = Math.max(0, Math.round((maxLayerH - layerH) / 2));

    for (const node of nodes) {
      const nodeX = currentX + Math.round((colW - node.width) / 2);
      relativePositions.set(node.id, { x: nodeX, y: currentY });
      currentY += node.height + intraGap;
    }

    currentX += colW + layerGap;
  }

  const clusterWidth = Math.max(1, currentX - layerGap);
  const clusterHeight = maxLayerH;

  const origCentroidX = clusterItems.reduce((sum, i) => sum + i.x + i.width / 2, 0) / clusterItems.length;
  const origCentroidY = clusterItems.reduce((sum, i) => sum + i.y + i.height / 2, 0) / clusterItems.length;

  return {
    items: clusterItems,
    relativePositions,
    width: clusterWidth,
    height: clusterHeight,
    originalCentroid: { x: origCentroidX, y: origCentroidY },
  };
}

/**
 * Lays out an unconnected spatial cluster into an editorial, balanced local grid.
 */
function layoutUnconnectedCluster(
  clusterItems: MoodboardItem[],
  inDegree: Map<string, number>,
  outDegree: Map<string, number>,
  intraGap = 28
): ArrangedCluster {
  if (clusterItems.length === 1) {
    const item = clusterItems[0];
    const relPos = new Map<string, { x: number; y: number }>();
    relPos.set(item.id, { x: 0, y: 0 });
    return {
      items: clusterItems,
      relativePositions: relPos,
      width: item.width,
      height: item.height,
      originalCentroid: { x: item.x + item.width / 2, y: item.y + item.height / 2 },
    };
  }

  // Sort items by evidence importance, then spatial position, then deterministic id
  const sorted = [...clusterItems].sort((a, b) => {
    const impDiff =
      computeEvidenceImportance(b, inDegree, outDegree) -
      computeEvidenceImportance(a, inDegree, outDegree);
    if (impDiff !== 0) return impDiff;
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return a.id.localeCompare(b.id);
  });

  const count = sorted.length;
  const cols = count <= 2 ? 2 : count <= 4 ? 2 : count <= 8 ? 3 : 4;

  const colWidths = new Array(cols).fill(0);
  const colHeights = new Array(cols).fill(0);

  for (let i = 0; i < sorted.length; i++) {
    const colIdx = i % cols;
    colWidths[colIdx] = Math.max(colWidths[colIdx], sorted[i].width);
  }

  const colXs = [0];
  for (let c = 1; c < cols; c++) {
    colXs[c] = colXs[c - 1] + colWidths[c - 1] + intraGap;
  }

  const relativePositions = new Map<string, { x: number; y: number }>();

  for (const item of sorted) {
    let minCol = 0;
    for (let c = 1; c < cols; c++) {
      if (colHeights[c] < colHeights[minCol]) {
        minCol = c;
      }
    }

    const x = colXs[minCol];
    const y = colHeights[minCol];
    relativePositions.set(item.id, { x, y });
    colHeights[minCol] += item.height + intraGap;
  }

  const totalW = colXs[cols - 1] + colWidths[cols - 1];
  const totalH = Math.max(...colHeights) - (sorted.length > 0 ? intraGap : 0);

  const origCentroidX = clusterItems.reduce((sum, i) => sum + i.x + i.width / 2, 0) / clusterItems.length;
  const origCentroidY = clusterItems.reduce((sum, i) => sum + i.y + i.height / 2, 0) / clusterItems.length;

  return {
    items: clusterItems,
    relativePositions,
    width: Math.max(1, totalW),
    height: Math.max(1, totalH),
    originalCentroid: { x: origCentroidX, y: origCentroidY },
  };
}

/**
 * Packs multiple distinct clusters into a cohesive, landscape-oriented composition
 * preserving macro-spatial intent (original cluster centroids) and generous breathing room.
 */
function packClusters(
  clusters: ArrangedCluster[],
  startX: number,
  startY: number,
  interClusterGap = 140
): PositionUpdate[] {
  if (clusters.length === 0) return [];

  // Sort clusters preserving macro-spatial intent:
  // Primary vertical centroid (with a 160px band threshold), secondary horizontal centroid
  const sortedClusters = [...clusters].sort((a, b) => {
    const yDiff = a.originalCentroid.y - b.originalCentroid.y;
    if (Math.abs(yDiff) > 160) return yDiff;
    return a.originalCentroid.x - b.originalCentroid.x;
  });

  const totalArea = sortedClusters.reduce((sum, c) => sum + c.width * c.height, 0);
  const targetRowWidth = Math.max(1200, Math.round(Math.sqrt(totalArea) * 1.5));

  const updates: PositionUpdate[] = [];
  let currentY = startY;
  let currentRowClusters: ArrangedCluster[] = [];
  let currentRowWidth = 0;

  const flushRow = (rowClusters: ArrangedCluster[], rowY: number): number => {
    if (rowClusters.length === 0) return 0;
    const maxRowH = Math.max(...rowClusters.map((c) => c.height));
    let clusterX = startX;

    for (const cluster of rowClusters) {
      // Vertically center cluster in current row band
      const clusterY = rowY + Math.round((maxRowH - cluster.height) / 2);

      for (const [id, relPos] of cluster.relativePositions.entries()) {
        updates.push({
          id,
          x: clusterX + relPos.x,
          y: clusterY + relPos.y,
        });
      }

      clusterX += cluster.width + interClusterGap;
    }

    return maxRowH;
  };

  for (const cluster of sortedClusters) {
    const projectedWidth =
      currentRowWidth + (currentRowClusters.length > 0 ? interClusterGap : 0) + cluster.width;

    if (currentRowClusters.length > 0 && projectedWidth > targetRowWidth) {
      const rowHeight = flushRow(currentRowClusters, currentY);
      currentY += rowHeight + interClusterGap;
      currentRowClusters = [cluster];
      currentRowWidth = cluster.width;
    } else {
      currentRowClusters.push(cluster);
      currentRowWidth = projectedWidth;
    }
  }

  if (currentRowClusters.length > 0) {
    flushRow(currentRowClusters, currentY);
  }

  return updates;
}

/**
 * SMART ARRANGE
 *
 * Intelligently organizes the Moodboard while preserving creative relationships,
 * hierarchy, and user intent.
 *
 * 1. Graph Connected Components: items linked by directed connector arrows are kept
 *    together and organized directionally (Sources -> Hubs -> Sinks).
 * 2. Spatial Proximity: items grouped nearby without connectors form balanced clusters.
 * 3. Evidence-based hierarchy: nodes with higher degrees naturally act as hubs without
 *    rigid type assumptions.
 * 4. Freehand strokes: strokes intersecting cards move by the exact same delta,
 *    preventing drawings from being mangled or detached.
 * 5. Deterministic: identical input coordinates produce identical output coordinates.
 */
export function calculateSmartArrange(
  items: MoodboardItem[],
  targetIds?: string[],
  options?: SmartArrangeOptions
): PositionUpdate[] {
  const allActive = items.filter((i) => !i.deleted_at);
  if (allActive.length === 0) return [];

  const targetIdSet = targetIds && targetIds.length > 0 ? new Set(targetIds) : null;
  const targetItems = targetIdSet ? allActive.filter((i) => targetIdSet.has(i.id)) : allActive;
  if (targetItems.length === 0) return [];

  const cardItems = targetItems.filter((i) => i.type !== 'stroke');
  const strokeItems = allActive.filter((i) => i.type === 'stroke');

  if (cardItems.length === 0) return [];

  const intraGap = options?.intraClusterGap ?? 28;
  const layerGap = options?.layerGap ?? 56;
  const interClusterGap = options?.interClusterGap ?? 140;

  // Extract all active directed connections
  const allConnections = extractActiveConnections(allActive);
  const cardIdSet = new Set(cardItems.map((c) => c.id));

  // Filter connections where both endpoints are within the active card set
  const filteredConnections = allConnections.filter(
    (c) => cardIdSet.has(c.fromId) && cardIdSet.has(c.targetId)
  );

  // Compute in/out degrees for evidence-based importance
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  for (const item of cardItems) {
    inDegree.set(item.id, 0);
    outDegree.set(item.id, 0);
  }

  for (const c of filteredConnections) {
    outDegree.set(c.fromId, (outDegree.get(c.fromId) || 0) + 1);
    inDegree.set(c.targetId, (inDegree.get(c.targetId) || 0) + 1);
  }

  // 1. Build undirected graph for connected component detection
  const adj = new Map<string, Set<string>>();
  for (const item of cardItems) {
    adj.set(item.id, new Set());
  }
  for (const c of filteredConnections) {
    adj.get(c.fromId)?.add(c.targetId);
    adj.get(c.targetId)?.add(c.fromId);
  }

  const visited = new Set<string>();
  const connectedClusters: MoodboardItem[][] = [];
  const unconnectedCards: MoodboardItem[] = [];

  // Deterministic order: sort cards by importance desc, then original y, x, id
  const sortedCards = [...cardItems].sort((a, b) => {
    const impDiff =
      computeEvidenceImportance(b, inDegree, outDegree) -
      computeEvidenceImportance(a, inDegree, outDegree);
    if (impDiff !== 0) return impDiff;
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return a.id.localeCompare(b.id);
  });

  for (const card of sortedCards) {
    if (visited.has(card.id)) continue;
    const neighbors = adj.get(card.id);

    if (neighbors && neighbors.size > 0) {
      const component: MoodboardItem[] = [];
      const queue = [card.id];
      visited.add(card.id);

      while (queue.length > 0) {
        const currId = queue.shift()!;
        const itm = cardItems.find((i) => i.id === currId);
        if (itm) component.push(itm);

        const sortedNeighbors = Array.from(adj.get(currId) || []).sort();
        for (const nId of sortedNeighbors) {
          if (!visited.has(nId)) {
            visited.add(nId);
            queue.push(nId);
          }
        }
      }
      connectedClusters.push(component);
    } else {
      unconnectedCards.push(card);
    }
  }

  // 2. Cluster unconnected cards by spatial proximity (threshold = 140px)
  const PROXIMITY_THRESHOLD = 140;
  const proximityClusters: MoodboardItem[][] = [];
  const proxVisited = new Set<string>();

  const sortedUnconnected = [...unconnectedCards].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return a.id.localeCompare(b.id);
  });

  for (const item of sortedUnconnected) {
    if (proxVisited.has(item.id)) continue;
    const group: MoodboardItem[] = [item];
    proxVisited.add(item.id);
    const queue = [item];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const candidate of sortedUnconnected) {
        if (!proxVisited.has(candidate.id)) {
          if (computeBoundingBoxDistance(curr, candidate) <= PROXIMITY_THRESHOLD) {
            proxVisited.add(candidate.id);
            group.push(candidate);
            queue.push(candidate);
          }
        }
      }
    }
    proximityClusters.push(group);
  }

  // 3. Lay out each cluster individually
  const arrangedClusters: ArrangedCluster[] = [];

  for (const cluster of connectedClusters) {
    arrangedClusters.push(
      layoutConnectedCluster(cluster, filteredConnections, inDegree, outDegree, intraGap, layerGap)
    );
  }

  for (const cluster of proximityClusters) {
    arrangedClusters.push(
      layoutUnconnectedCluster(cluster, inDegree, outDegree, intraGap)
    );
  }

  // 4. Determine origin anchor
  let startX = Math.min(...cardItems.map((i) => i.x));
  let startY = Math.min(...cardItems.map((i) => i.y));

  // If specific target items are selected, center the cluster around the selection bounding box
  if (targetIdSet && targetIdSet.size > 1) {
    const origMinX = Math.min(...cardItems.map((i) => i.x));
    const origMaxX = Math.max(...cardItems.map((i) => i.x + i.width));
    const origMinY = Math.min(...cardItems.map((i) => i.y));
    const origMaxY = Math.max(...cardItems.map((i) => i.y + i.height));
    const centerSelectionX = (origMinX + origMaxX) / 2;
    const centerSelectionY = (origMinY + origMaxY) / 2;

    // Pack temporarily at 0, 0
    const rawUpdates = packClusters(arrangedClusters, 0, 0, interClusterGap);
    if (rawUpdates.length > 0) {
      const packedMinX = Math.min(...rawUpdates.map((u) => u.x));
      const packedMaxX = Math.max(
        ...rawUpdates.map((u) => {
          const itm = cardItems.find((i) => i.id === u.id);
          return u.x + (itm?.width || 0);
        })
      );
      const packedMinY = Math.min(...rawUpdates.map((u) => u.y));
      const packedMaxY = Math.max(
        ...rawUpdates.map((u) => {
          const itm = cardItems.find((i) => i.id === u.id);
          return u.y + (itm?.height || 0);
        })
      );

      const packedW = packedMaxX - packedMinX;
      const packedH = packedMaxY - packedMinY;

      startX = Math.round(centerSelectionX - packedW / 2);
      startY = Math.round(centerSelectionY - packedH / 2);
    }
  }

  // 5. Pack clusters on canvas
  const cardUpdates = packClusters(arrangedClusters, startX, startY, interClusterGap);

  // 6. Stroke handling: any stroke that intersects a moved card moves by identical delta
  const cardUpdateMap = new Map(cardUpdates.map((u) => [u.id, u]));
  const strokeUpdates: PositionUpdate[] = [];

  for (const stroke of strokeItems) {
    let parentCard: MoodboardItem | undefined;
    for (const card of cardItems) {
      if (cardUpdateMap.has(card.id) && checkBoundingBoxIntersection(stroke, card, 16)) {
        parentCard = card;
        break;
      }
    }

    if (parentCard) {
      const nextPos = cardUpdateMap.get(parentCard.id)!;
      const deltaX = nextPos.x - parentCard.x;
      const deltaY = nextPos.y - parentCard.y;
      strokeUpdates.push({
        id: stroke.id,
        x: stroke.x + deltaX,
        y: stroke.y + deltaY,
      });
    }
  }

  return [...cardUpdates, ...strokeUpdates];
}

/**
 * Backwards-compatible alias for calculateSmartArrange.
 */
export function calculateAutoArrange(
  items: MoodboardItem[],
  targetIds?: string[]
): PositionUpdate[] {
  return calculateSmartArrange(items, targetIds);
}
