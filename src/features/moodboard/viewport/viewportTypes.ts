import type { ViewportTransform } from '../coordinates';

export type ViewportState = ViewportTransform;

export interface ViewportDimensions {
  width: number;
  height: number;
}

export interface UseCanvasViewportOptions {
  stageRef: React.RefObject<{
    x: (val?: number) => number;
    y: (val?: number) => number;
    scaleX: (val?: number) => number;
    scaleY: (val?: number) => number;
    batchDraw: () => void;
    getPointerPosition: () => { x: number; y: number } | null;
  } | null>;
  viewport: ViewportTransform;
  onViewportChange: (viewport: ViewportTransform) => void;
  onZoomToFit?: (width: number, height: number) => void;
  isTextInputActive?: () => boolean;
  disabled?: boolean;
}

export interface UseCanvasViewportReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  dimensions: ViewportDimensions;
  isSpacePressed: boolean;
  isMiddlePanning: boolean;
  handleContainerMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleWheel: (e: { evt: WheelEvent; target?: unknown }) => void;
  handleStageDragMove: (e: { target: unknown }) => boolean;
  handleStageDragEnd: (e: { target: unknown }) => boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  resetViewport: () => void;
}
