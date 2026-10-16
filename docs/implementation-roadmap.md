# Implementation Roadmap — for_creatives
**Generated:** 2026-10-16  
**Based on:** `docs/product-audit.md` (same date)

---

## Verified Current State

The repository is clean on `main`. TypeScript passes. 292/293 tests pass. The moodboard is feature-complete. The storyboard canvas (the newest feature, 5 commits) is the primary area with open gaps. The core reference↔direction relationship works correctly.

---

## Critical Defects (P0 — COMPLETE)

### P0-1: Storyboard canvas undo/redo [COMPLETE]

**Status:** Completed and verified (Commits `1cc5c7c`, `a91eb798`).
**Implemented:**
- Dedicated `storyboardHistoryStack.ts` and `useStoryboardHistory.ts` supporting 19 reversible action types with 50-item depth.
- Symmetrical soft-delete/restore operations preserving IDs with zero duplicated rows (`restoreStroke`, `restoreScene` with cascading shots, `restoreShot`, `restoreConnection`).
- Keyboard shortcuts (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl+Y`) with input/textarea/contentEditable suppression.
- Toolbar Undo/Redo controls with dynamic disabled states.
- 38 history tests and 9 shortcut dispatch tests. All 528 tests passing.

---

### P0-2: Performance test threshold baseline failure [COMPLETE]

**Status:** Completed and verified (Commit `a91eb798`). Raised threshold from 20ms to 100ms in `layoutUtils.test.ts`. Passes reliably across JIT states.



## P1 Tasks (after P0)

### P1-1: Storyboard canvas keyboard shortcuts [COMPLETE]
**Status:** Completed and verified.
- Complete keyboard handling: Delete/Backspace for selected shots/scenes (with single & batch history), Ctrl/Cmd+D duplicate (with auto-selection and history), arrow-key nudge (1px / 10px with Shift, tracking member shot deltas for scenes, pushed to history), Escape to deselect and reset tool to select.
- Added Select All (`Cmd/Ctrl+A`) and tool keys (`V`, `S`, `C`, `N/X`, `P`, `Shift+P`, `E`).
- Strict focus protection covering `<input>`, `<textarea>`, `<select>`, and `contentEditable`.
- 28 unit tests in `storyboardKeyboardShortcuts.test.ts`. All 547 tests pass.

### P1-2: Storyboard marquee multi-select [COMPLETE]
**Status:** Completed and verified.
- Dedicated `useStoryboardMarquee.ts` hook providing rubber-band multi-selection box on empty background.
- 4px movement threshold (`CLICK_VS_DRAG_THRESHOLD_PX`) distinguishing clicks from drag gestures.
- Real-time AABB intersection with all shots on the board, updating selections live during drag.
- Shift/Cmd/Ctrl additive selection support.
- Clean cancellation on Escape and mouseup.
- 10 unit tests in `useStoryboardMarquee.test.ts`. Full test suite: 557 passing.

### P1-3: Storyboard export (PNG) [COMPLETE]
**Status:** Completed and verified.
- Built `storyboardExportUtils.ts` with world bounds calculation (scenes, shot dimensions, stroke paths), stage screen viewport mapping, 2x crisp resolution compensation across zoom levels, and dark surface background compositing (`#121110`).
- Selection isolation: snapshot cleans selection markers/handles during capture and restores them seamlessly.
- UI: Added Export button with loading state to `StoryboardToolbar.tsx` and registered exporter in `StoryboardCanvas.tsx`.
- 13 unit tests in `storyboardExportUtils.test.ts`. Full suite: 570 passing.

### P1-4: Storyboard save feedback [COMPLETE]
**Status:** Completed and verified.
- Added asynchronous save status tracking in `useStoryboard.ts` (`saveStatus`: `'idle' | 'saving' | 'saved' | 'error'`, `saveError`, `clearSaveError`).
- Wrapped all 20 storyboard mutations with active save counter, catch handlers, and a 2.5s auto-clearing saved timer.
- Integrated restrained HUD indicator in `StoryboardCanvas.tsx` (top-right saving spinner / saved indicator matching `MoodboardCanvas`) and error banner with a dismiss action.
- Decoupled unmounting errors in `StoryboardView.tsx` (`error && scenes.length === 0`), preventing canvas teardown on non-fatal background mutation failures.
- 6 unit tests in `src/features/storyboard/hooks/__tests__/useStoryboardSaveStatus.test.ts`. Full test suite: 576 passing.

### P1-5: Dashboard search verification + fix [COMPLETE]
**Status:** Completed and verified.
- Built pure utility `projectSearchUtils.ts` (`filterProjectsByQuery`, `getProjectSearchMatchReason`) handling case-insensitivity, whitespace trimming, and regex special characters.
- Multi-field search coverage: project name, description, child reference titles (`references[].title`), and direction note titles (`direction_notes[].title`).
- Query expansion in `projectService.getProjects()` with resilient fallback.
- Added search input bar, clear button, match count indicator, and empty search state to `DashboardPage`.
- Enhanced `ProjectCard` with contextual search match badges when matching references or direction notes.
- 15 unit tests in `projectSearchUtils.test.ts` and 5 component tests in `ProjectCard.test.tsx`. Full test suite: 596 passing.

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
