/**
 * 2D Point in canvas, screen, or item-local coordinate space.
 */
export interface CanvasPoint {
  x: number;
  y: number;
}

/**
 * Rectangular boundary box in canvas or screen space.
 */
export interface CanvasBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 2D Viewport transformation representing stage offset (pan) and zoom level.
 */
export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

/**
 * Bounding client rectangle of the canvas container DOM element.
 */
export interface ContainerRect {
  left: number;
  top: number;
  width?: number;
  height?: number;
}

/**
 * Cardinal anchor positions supported on canvas items.
 */
export type CardinalAnchor = 'top' | 'right' | 'bottom' | 'left';
