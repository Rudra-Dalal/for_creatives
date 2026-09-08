/**
 * Authoritative single source of truth for distinguishing a stationary click
 * from a drag gesture across the entire moodboard canvas architecture.
 *
 * Used for:
 * - Selection click-vs-drag collapse (releasing after <= CLICK_VS_DRAG_THRESHOLD_PX collapses multi-selection to clicked item)
 * - Marquee initiation threshold (drag movement must exceed CLICK_VS_DRAG_THRESHOLD_PX to show selection rectangle)
 * - Connector drag initiation threshold
 *
 * NO OTHER hardcoded threshold (e.g. 3px, 5px, 6px) is permitted anywhere in the canvas codebase.
 */
export const CLICK_VS_DRAG_THRESHOLD_PX = 4;

/**
 * Standard default viewport zoom boundaries.
 */
export const MIN_CANVAS_SCALE = 0.2;
export const MAX_CANVAS_SCALE = 3.0;

/**
 * Corner resize handle protection zone size (in screen-equivalent pixels).
 * Used to ensure cardinal connector anchors never encroach into corner handle hit regions.
 */
export const CORNER_PRIORITY_ZONE_PX = 20;
