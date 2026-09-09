/**
 * Pure, generic stack management utilities for the moodboard canvas undo/redo history.
 *
 * Intentionally has zero imports so it can be unit-tested without any React or
 * Supabase context, and to avoid a circular dependency with useMoodboard.ts.
 * UndoAction-specific reconciliation logic lives in useMoodboard.ts.
 */

/** Maximum number of actions retained in either the undo or redo stack. */
export const MAX_HISTORY_DEPTH = 100;

/**
 * Push an action onto a stack, enforcing the history depth limit.
 * Returns a new array — the original is not mutated.
 */
export function pushToStack<T>(stack: readonly T[], action: T): T[] {
  return [...stack.slice(-(MAX_HISTORY_DEPTH - 1)), action];
}

/**
 * Pop the most recent action from a stack.
 * Returns { action, remaining } where `remaining` is a new array without the
 * popped entry.  Returns { action: null, remaining: [] } if the stack is empty.
 */
export function popFromStack<T>(stack: readonly T[]): {
  action: T | null;
  remaining: T[];
} {
  if (stack.length === 0) return { action: null, remaining: [] };
  return {
    action: stack[stack.length - 1],
    remaining: stack.slice(0, -1) as T[],
  };
}

/**
 * Walk every entry in a stack through a `reconcile` callback.
 * Returns a new array — the original is not mutated.
 *
 * UndoAction-specific ID reconciliation (temp-stroke-... → real UUID) is
 * implemented as a reconcile callback inside useMoodboard.ts.
 */
export function reconcileStack<T>(stack: readonly T[], reconcile: (item: T) => T): T[] {
  return stack.map(reconcile);
}
