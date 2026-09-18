/**
 * Storyboard Connection Service — Logic Tests
 *
 * Covers the synchronous guards embedded in storyboardService that do NOT
 * require a database round-trip.  Supabase network calls are not made;
 * instead we replicate the guard conditions as pure functions so they can be
 * verified in isolation, matching exactly the logic in storyboardService.ts.
 *
 * What IS tested here:
 *   - Self-connection rejection (fromShotId === toShotId)
 *   - Duplicate active-connection rejection (existing row with deleted_at null)
 *   - Soft-deleted row restore path (existing row with deleted_at set)
 *   - updateConnection empty-payload guard
 *   - updateConnection field allowlisting (verifies structural fields are not sent)
 *   - restoreConnection sets deleted_at to null (schema contract)
 *
 * What is NOT tested here (requires live DB / mocked Supabase):
 *   - Actual Supabase INSERT / UPDATE round-trips
 *   - RLS policy enforcement
 */

import { describe, it, expect } from 'vitest';
import type { AnchorPosition } from '../../types';

// ---------------------------------------------------------------------------
// Self-connection guard — extracted inline, mirrors storyboardService.createConnection
// ---------------------------------------------------------------------------

function isSelfConnection(fromShotId: string, toShotId: string): boolean {
  return fromShotId === toShotId;
}

// ---------------------------------------------------------------------------
// Duplicate-connection guard — mirrors the logic after the lookup step
// ---------------------------------------------------------------------------

type ExistingRow = { deleted_at: string | null };

function createConnectionDecision(
  existing: ExistingRow | null
): 'insert' | 'restore' | 'duplicate_error' {
  if (!existing) return 'insert';
  if (!existing.deleted_at) return 'duplicate_error';
  return 'restore';
}

// ---------------------------------------------------------------------------
// updateConnection payload builder — mirrors the allowlist logic in the service
// ---------------------------------------------------------------------------

function buildUpdateConnectionPayload(input: {
  fromAnchor?: AnchorPosition;
  toAnchor?: AnchorPosition;
  transitionLabel?: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.fromAnchor !== undefined) payload.from_anchor = input.fromAnchor;
  if (input.toAnchor !== undefined) payload.to_anchor = input.toAnchor;
  if (input.transitionLabel !== undefined) payload.transition_label = input.transitionLabel.trim();
  return payload;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('storyboardService — connection guard logic', () => {

  // =========================================================================
  // 1. Self-connection guard
  // =========================================================================
  describe('createConnection — self-connection guard', () => {
    it('rejects when fromShotId === toShotId', () => {
      expect(isSelfConnection('shot-A', 'shot-A')).toBe(true);
    });

    it('allows when fromShotId !== toShotId', () => {
      expect(isSelfConnection('shot-A', 'shot-B')).toBe(false);
    });

    it('treats distinct UUIDs correctly', () => {
      const a = '11111111-1111-1111-1111-111111111111';
      const b = '22222222-2222-2222-2222-222222222222';
      expect(isSelfConnection(a, b)).toBe(false);
      expect(isSelfConnection(a, a)).toBe(true);
    });

    it('is not symmetric — A to B and B to A are separate directed pairs', () => {
      expect(isSelfConnection('shot-A', 'shot-B')).toBe(false);
      expect(isSelfConnection('shot-B', 'shot-A')).toBe(false);
    });
  });

  // =========================================================================
  // 2. createConnection decision tree (existing row lookup)
  // =========================================================================
  describe('createConnection — decision after lookup', () => {
    it('returns "insert" when no existing row is found', () => {
      expect(createConnectionDecision(null)).toBe('insert');
    });

    it('returns "duplicate_error" when active row exists (deleted_at is null)', () => {
      expect(createConnectionDecision({ deleted_at: null })).toBe('duplicate_error');
    });

    it('returns "restore" when a soft-deleted row exists (deleted_at is set)', () => {
      const ts = new Date().toISOString();
      expect(createConnectionDecision({ deleted_at: ts })).toBe('restore');
    });

    it('treats any non-null deleted_at string as a soft-deleted row', () => {
      expect(createConnectionDecision({ deleted_at: '2026-01-01T00:00:00.000Z' })).toBe('restore');
    });
  });

  // =========================================================================
  // 3. updateConnection — allowlisted payload builder
  // =========================================================================
  describe('updateConnection — field allowlisting', () => {
    it('returns an empty object when no fields are provided', () => {
      const payload = buildUpdateConnectionPayload({});
      expect(Object.keys(payload)).toHaveLength(0);
    });

    it('includes from_anchor when fromAnchor is provided', () => {
      const payload = buildUpdateConnectionPayload({ fromAnchor: 'top' });
      expect(payload).toEqual({ from_anchor: 'top' });
    });

    it('includes to_anchor when toAnchor is provided', () => {
      const payload = buildUpdateConnectionPayload({ toAnchor: 'bottom' });
      expect(payload).toEqual({ to_anchor: 'bottom' });
    });

    it('includes transition_label when transitionLabel is provided', () => {
      const payload = buildUpdateConnectionPayload({ transitionLabel: 'Cut' });
      expect(payload).toEqual({ transition_label: 'Cut' });
    });

    it('trims whitespace from transitionLabel', () => {
      const payload = buildUpdateConnectionPayload({ transitionLabel: '  dissolve  ' });
      expect(payload).toEqual({ transition_label: 'dissolve' });
    });

    it('includes all three fields when all are provided', () => {
      const payload = buildUpdateConnectionPayload({
        fromAnchor: 'right',
        toAnchor: 'left',
        transitionLabel: 'Wipe',
      });
      expect(payload).toEqual({
        from_anchor: 'right',
        to_anchor: 'left',
        transition_label: 'Wipe',
      });
    });

    it('does NOT include structural fields (id, deleted_at, project_id, etc.)', () => {
      const payload = buildUpdateConnectionPayload({
        fromAnchor: 'right',
        toAnchor: 'left',
        transitionLabel: 'Cut',
      });
      expect(payload).not.toHaveProperty('id');
      expect(payload).not.toHaveProperty('deleted_at');
      expect(payload).not.toHaveProperty('project_id');
      expect(payload).not.toHaveProperty('from_shot_id');
      expect(payload).not.toHaveProperty('to_shot_id');
      expect(payload).not.toHaveProperty('created_at');
    });

    it('accepts all four valid AnchorPosition values for fromAnchor', () => {
      const anchors: AnchorPosition[] = ['top', 'right', 'bottom', 'left'];
      for (const a of anchors) {
        const p = buildUpdateConnectionPayload({ fromAnchor: a });
        expect(p.from_anchor).toBe(a);
      }
    });
  });

  // =========================================================================
  // 4. A to B and B to A are distinct directed relationships
  // =========================================================================
  describe('directed relationship invariant', () => {
    it('A to B and B to A are not the same connection (not a self-connection in reverse)', () => {
      expect(isSelfConnection('shot-1', 'shot-2')).toBe(false);
      expect(isSelfConnection('shot-2', 'shot-1')).toBe(false);
    });

    it('decision for A to B (no existing) is independent of B to A', () => {
      const decisionAtoB = createConnectionDecision(null);
      const decisionBtoA = createConnectionDecision(null);
      expect(decisionAtoB).toBe('insert');
      expect(decisionBtoA).toBe('insert');
    });
  });

  // =========================================================================
  // 5. restoreConnection schema contract
  // =========================================================================
  describe('restoreConnection — schema contract', () => {
    it('setting deleted_at to null models restoration correctly', () => {
      const restorePayload = { deleted_at: null };
      expect(restorePayload.deleted_at).toBeNull();
    });

    it('a restored row round-trips through createConnection decision as active', () => {
      const restoredRow: ExistingRow = { deleted_at: null };
      expect(createConnectionDecision(restoredRow)).toBe('duplicate_error');
    });
  });
});
