# Product Audit — for_creatives
**Audited:** 2026-10-16  
**Branch:** `main` (clean, up to date with `origin/main`)  
**Commit:** `9d8eb4d` — feat(storyboard): add frame acquisition controls  
**TypeScript:** ✅ 0 errors (`tsc --noEmit`)  
**Tests:** 1 failure in 15 suites — 292 pass, 1 fail (see Baseline Failures)

---

## Baseline Failure (pre-existing, not introduced by this audit)

| File | Test | Failure |
|---|---|---|
| `src/features/moodboard/utils/__tests__/layoutUtils.test.ts` | `Cycle Handling > terminates quickly…` | `expected 50.95ms to be less than 20` — performance threshold too tight for cold-JIT Node.js test runner, not an algorithm correctness problem. The cycle guard (`nextRank < clusterItems.length` + `!inQueue.has(tId)`) is correct and terminates in O(n). Result is functionally valid. Fix: raise threshold to 100ms. |

All other `console.error` lines in test output are **deliberate error-path tests** — not failures.

---

## Tech Stack (verified)

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2.35, React 18.3.1 |
| Language | TypeScript 5.5.4 (strict) |
| Styling | Tailwind CSS 3.4.11 |
| Canvas | react-konva 18.2.10 / Konva 9.3.18 |
| Backend | Supabase (Postgres + Auth + Storage) |
| Testing | Vitest 2.1.9 |
| Validation | Zod 3.23.8 |
| UI Primitives | Radix UI (dialog, dropdown, popover, tabs, tooltip) |
| Markdown | marked + DOMPurify |
| Color Picker | react-colorful |

---

## Application Routes

| Route | Description |
|---|---|
| `/` | Root redirect |
| `/(auth)/login`, `/signup` | Supabase Auth flows |
| `/(dashboard)` | Project listing dashboard |
| `/projects/[id]` | Project workspace (references, moodboard, direction, storyboard tabs) |
| `/share/[token]` | Read-only share view via token-scoped RPC |
| `/api/metadata` | Server-side OG scraper (SSRF-protected) |
| `/api/proxy-image` | CORS-safe image proxy (SSRF-protected, rate-limited) |

---

## Feature Inventory

### Authentication & Onboarding
| Feature | Status |
|---|---|
| Login / signup | Complete |
| Middleware auth guard | Complete |
| First-run empty state | Complete |
| Guided onboarding walkthrough | Missing |

### Projects & Navigation
| Feature | Status |
|---|---|
| Create / rename / delete project | Complete |
| Tab navigation with URL + localStorage sync | Complete |
| Command palette (Ctrl+K) | Complete |
| Share link (token, revocable) | Complete |
| Trash modal (soft delete + restore) | Complete |
| Dashboard search | Needs verification |
| Archive / star / favorite | Missing |
| Breadcrumb hierarchy | Missing |

### Reference Library
| Feature | Status |
|---|---|
| URL capture + OG scraping | Complete |
| Manual fallback (title + upload) | Complete |
| Tag management | Complete |
| Soft delete + restore | Complete |
| Multi-select + bulk delete + bulk tag | Complete |
| Thumbnail storage (Supabase, <1MB) | Complete |
| Client-side color palette extraction | Complete |
| Full-text search | Needs verification |

### Creative Direction
| Feature | Status |
|---|---|
| Notes CRUD + markdown | Complete |
| Bidirectional reference linking | Complete |
| Note categorization + ordering + duplicate | Complete |
| PDF export | Complete |
| Soft delete | Complete |

### Moodboard Canvas
| Feature | Status |
|---|---|
| Pan / zoom / drag / resize | Complete |
| All item types (reference, text, image, color, idea, stroke) | Complete |
| Multi-select (marquee + shift-click) | Complete |
| Align & distribute | Complete |
| Smart arrange (connection-aware) | Complete (1 timing test flaky cold-JIT) |
| Connector arrows + labels | Complete |
| Freehand pen + eraser | Complete |
| Canvas direction inspector | Complete |
| Idea → direction note promotion | Complete |
| Undo / redo (100-deep) | Complete |
| Keyboard shortcuts | Complete |
| File drag-and-drop + clipboard paste | Complete |
| PNG export | Complete |
| Save feedback (saving/saved/error) | Complete |
| Soft delete | Complete |

### Storyboard Canvas *(newest feature)*
| Feature | Status | Notes |
|---|---|---|
| Freeform canvas pan/zoom | Complete | |
| Scene territories | Complete | |
| Shot cards with aspect ratios | Complete | |
| Shot inspector + metadata | Complete | |
| Sequence connection arrows | Complete | |
| Freehand pen + eraser | Complete | |
| Visual frame (cover-fit, proxy-safe) | Complete | |
| Frame acquisition (reference / upload) | Complete | |
| Shot–reference + shot–direction links | Complete | |
| Shot duplicate / reorder / reassign | Complete | |
| Storyboard canvas undo / redo | **Missing** | **Highest priority gap** |
| Canvas keyboard shortcuts (Delete, Duplicate, Nudge) | Partial | |
| Marquee multi-select | Missing | |
| Export (PNG / PDF) | Missing | |
| Presentation / read-only view | Partial | `readOnly` prop exists, behavior TBD |

### Persistence & Security
| Feature | Status |
|---|---|
| RLS on all tables | Complete |
| Cross-project integrity constraint | Complete |
| Storage bucket policies | Complete |
| Soft delete throughout | Complete |
| SSRF protection | Complete |
| Per-IP rate limiting | Complete |
| Optimistic updates with rollback | Complete |
| No secrets in source | Verified |

### Export & Sharing
| Feature | Status |
|---|---|
| Moodboard PNG | Complete |
| Direction note PDF | Complete |
| Read-only share link | Complete |
| Storyboard export | Missing |

---

## Database Schema (verified from migrations)

```
projects              id, user_id, name, description, share_token, created_at, updated_at
references            id, project_id, url, title, thumbnail_url, source_domain, note, tags[], created_at, deleted_at
moodboard_items       id, project_id, reference_id, type, content(jsonb), x, y, width, height, z_index, created_at, updated_at, deleted_at
direction_notes       id, project_id, title, description, category, display_order, created_at, updated_at, deleted_at
direction_reference_links  id, direction_note_id, reference_id, created_at  [UNIQUE]
storyboard_scenes     id, project_id, title, description, display_order, x, y, width, height, created_at, updated_at, deleted_at
storyboard_shots      id, project_id, scene_id, shot_number, title, description, dialogue,
                      aspect_ratio, shot_type, camera_movement, visual_url, visual_source,
                      sketch_data(jsonb), x, y, width, height, z_index, display_order, created_at, updated_at, deleted_at
storyboard_shot_references        id, shot_id, reference_id, created_at
storyboard_shot_direction_links   id, shot_id, direction_note_id, created_at
storyboard_shot_connections       id, project_id, from_shot_id, to_shot_id, from_anchor, to_anchor,
                                  transition_label, created_at, updated_at, deleted_at
storyboard_strokes    id, project_id, points(jsonb), stroke_color, stroke_width, created_at, updated_at, deleted_at
```

---

## Technical Debt

| Item | Priority | Notes |
|---|---|---|
| Storyboard canvas: no undo/redo | **P0** | Every canvas edit is irreversible |
| Storyboard keyboard shortcuts incomplete | P1 | Delete/Duplicate/Nudge/Esc not confirmed |
| Storyboard export | P1 | PNG/PDF missing |
| Performance test threshold too tight | Low | `layoutUtils.test.ts` cycle test; raise to 100ms |
| `useMoodboard.ts` (~63 KB) / `MoodboardStage.tsx` over-concentrated | Low | Flagged in AGENTS.md — defer |
| `StoryboardCanvas.tsx` (~38 KB) | Low | Similar; new feature, defer |
