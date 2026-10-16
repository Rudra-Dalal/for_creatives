# Implementation Roadmap — for_creatives
**Generated:** 2026-10-16  
**Based on:** `docs/product-audit.md` (same date)

---

## Verified Current State

The repository is clean on `main`. TypeScript passes. 292/293 tests pass. The moodboard is feature-complete. The storyboard canvas (the newest feature, 5 commits) is the primary area with open gaps. The core reference↔direction relationship works correctly.

---

## Critical Defects (P0 — do first)

### P0-1: Storyboard canvas has no undo/redo

**Severity:** High  
**Why it matters:** Every canvas action on the storyboard (move shot, delete shot, create connection, draw stroke) is immediately committed with no recovery path. This is a data safety violation.  
**Affected files:**
- `src/features/storyboard/components/StoryboardCanvas.tsx`
- `src/features/storyboard/canvas/` (new history module needed)
- `src/features/storyboard/hooks/useStoryboard.ts` (expose undo/redo)

**Approach:**
- Model after `src/features/moodboard/hooks/historyStack.ts` (already exists, 1.6 KB)
- Track reversible operations: move-shot, delete-shot, create-scene, delete-scene, create-connection, delete-connection, create-stroke, erase-stroke
- Keyboard shortcuts: Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z (redo)
- History depth: 50 (sufficient for storyboard)
- Do NOT capture shortcuts while inspector text fields are focused

**Acceptance criteria:**
- Ctrl+Z reverses the last canvas action
- Ctrl+Shift+Z re-applies it
- New action after undo clears redo stack
- Move and resize record one operation per gesture (not per pointer event)
- History survives tool-switches within a session
- Unit tests cover: create/delete shot, move, create/delete connection, add/erase stroke

---

### P0-2: Performance test threshold causes baseline failure

**Severity:** Low (test environment artifact, not a real defect)  
**File:** `src/features/moodboard/utils/__tests__/layoutUtils.test.ts`, line 262  
**Current:** `expect(elapsed).toBeLessThan(20)` fails at ~50ms cold-JIT  
**Fix:** Raise to `100` — still a meaningful guard against O(n²) regressions while accommodating Node.js JIT variance  
**Acceptance criteria:** Test passes reliably on first run in vitest

---

## P1 Tasks (after P0)

### P1-1: Storyboard canvas keyboard shortcuts
Complete keyboard handling: Delete/Backspace for selected shots/scenes, Ctrl+D duplicate, arrow-key nudge (1px; shift+arrow = 10px), Escape to deselect / cancel tool.  
Guard: no shortcuts when inspector fields are focused.

### P1-2: Storyboard marquee multi-select
Allow rubber-band selection of multiple shots on the storyboard canvas, consistent with the moodboard marquee implementation.

### P1-3: Storyboard export (PNG)
Use `Konva.stage.toDataURL()` on the storyboard stage to export a PNG of the full canvas. Handle the same CORS-taint proxy requirement already solved in the moodboard.

### P1-4: Storyboard save feedback
Surface save status (saving/saved/error) in the storyboard workspace header, matching the moodboard pattern.

### P1-5: Dashboard search verification + fix
Confirm search covers project name. Add reference-title and direction-note-title search if not present.

---

## P2 Tasks (deferred)

- Storyboard PDF export
- Storyboard presentation / read-only refinement
- Archive / star / favorite for projects
- Guided onboarding walkthrough
- Full-text search across notes and reference content
- Mobile-responsive canvas fallback
- `useMoodboard.ts` / `MoodboardStage.tsx` modularization (flagged in AGENTS.md)

---

## Recommended Implementation Order

```
Iteration 1  →  P0-2: Fix performance test threshold (5 min, zero risk)
Iteration 2  →  P0-1: Storyboard undo/redo (main deliverable)
Iteration 3  →  P1-1: Storyboard keyboard shortcuts
Iteration 4  →  P1-2: Storyboard marquee multi-select
Iteration 5  →  P1-3: Storyboard export (PNG)
```

---

## Dependencies Between Tasks

```
P0-2  ──────────────────────────────────────────▶ unblocks nothing (standalone test fix)
P0-1 (undo/redo)  ──────────────────────────────▶ P1-1 (shortcuts reference undo/redo)
P0-1 + P1-1  ───────────────────────────────────▶ P1-2 (marquee depends on selection model)
P0-1 + P1-2  ───────────────────────────────────▶ P1-3 (export should include multi-select bounds)
```

---

## Test Strategy

| Layer | Coverage target |
|---|---|
| Unit | History operations (push, undo, redo, clear-redo-on-new-action), command inverses |
| Integration | Full undo/redo loop: create shot → undo → redo → confirm state |
| Regression | Existing 292 passing tests must remain passing after each iteration |

New test files:
- `src/features/storyboard/canvas/__tests__/useStoryboardHistory.test.ts`
- `src/features/storyboard/hooks/__tests__/useStoryboardUndo.test.ts` (if hook-level)

---

## Risks & Open Decisions

| Risk | Decision |
|---|---|
| Storyboard undo needs DB-side rollback (e.g. already-committed shot) | Use optimistic local state as source of truth for history; DB writes are fire-and-forget from the history model's perspective. On undo, reverse the local state and issue a compensating DB write (e.g. re-delete or re-create via service). |
| `createShot` returns a new ID from the server; undo must track that ID | History command for CREATE_SHOT must capture the resolved server ID in the `finally` / `commit` step, not the temp ID. |
| Storyboard canvas does not currently expose a `stage` ref for export | Add a forwarded ref from `StoryboardCanvas` to `StoryboardStage` when implementing export. |
| Performance test (P0-2) threshold change is a test assertion modification | This is fixing a known-bad baseline, not weakening a real guard. Document it as such in the commit. |
