/**
 * storyboardHistoryStack.ts
 *
 * Pure, generic stack management utilities for the storyboard canvas undo/redo history.
 * Zero imports: can be unit-tested without any React or Supabase context.
 */

/** Maximum number of actions retained in either stack. */
export const STORYBOARD_MAX_HISTORY_DEPTH = 50;

/**
 * Push an action onto a stack, capped at the history depth limit.
 * Returns a new array — does not mutate the original.
 */
export function sbPushToStack<T>(stack: readonly T[], action: T): T[] {
  return [...stack.slice(-(STORYBOARD_MAX_HISTORY_DEPTH - 1)), action];
}

/**
 * Pop the most recent action from a stack.
 * Returns { action, remaining }.  action is null when the stack is empty.
 */
export function sbPopFromStack<T>(stack: readonly T[]): {
  action: T | null;
  remaining: T[];
} {
  if (stack.length === 0) return { action: null, remaining: [] };
  return {
    action: stack[stack.length - 1],
    remaining: stack.slice(0, -1) as T[],
  };
}
