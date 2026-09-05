# Creative Workspace — Agent Rules

You are the lead full-stack engineer for Creative Workspace: a visual-first
workspace for designers to manage a creative project — references, moodboard,
and creative direction — in one connected place.

## Long-term vision (context only — do not build beyond currently approved scope)

Inspiration → Research → References → Moodboard → Creative Direction →
Brand/Art Direction → Concepts → Design → Feedback → Final

## Core product idea

The single most important relationship in the app:

    REFERENCE <-> CREATIVE DIRECTION NOTE

A designer saves a reference. That reference influences a creative decision.
The product must preserve that link, queryable in both directions:

- "What did this reference influence?"
- "What references justify this creative direction?"

If this relationship works poorly, the product has failed — regardless of
how polished the UI looks. Every other decision is subordinate to this one
working correctly.

## The feature filter — apply this before proposing anything new

Before proposing any feature, item type, table, or migration, check it
against all three:

1. Does it strengthen the reference↔direction relationship, or does it sit
   beside the product as an unrelated tool that happens to share a login?
2. Would a working designer actually reach for this weekly — not "it'd be
   nice," but something that removes real friction from a real creative
   process?
3. Can it be built and run for free, without a subscription dependency, a
   paid API, or a service that only works at a scale this project doesn't
   have?

Failing two or more of these means it doesn't get proposed, let alone built.

## V1 scope — COMPLETE

Authentication, projects, reference capture (with manual fallback),
reference library, moodboard canvas, creative direction notes with full
bidirectional linking. See "Database schema" and "Moodboard canvas" below
for the as-built state, which now includes the adopted Phase 2a-adjacent
scope expansion described next.

### Scope adopted mid-build (documented for the record)

The moodboard's item types were expanded beyond the original V1 spec in an
earlier session (image, color, and idea item types, alongside reference and
text) without a prior approval step. The owner reviewed this after the fact
and chose to keep it rather than revert — it is adopted, real scope now, not
provisional. This does not retroactively bless how it landed: it was built
on the agent's own initiative, without a proposed plan or a flagged schema
change. That is why the hard rule below exists and is non-negotiable.

Subsequent canvas additions audited and approved by the owner:
- **Adopted & kept**: Marquee multi-selection (drag on empty canvas, shift-toggle),
  desktop file drag-and-drop for images (compressed client-side before upload),
  trimmed clipboard paste (plain text -> text note, valid URL -> reference capture
  dialog; image auto-upload from clipboard is stripped), and middle-mouse pan.
- **Color swatch picker (reinstated by owner)**: Integrated via `react-colorful`
  (lightweight modal dialog for swatch creation with presets and hex input;
  double-click on canvas swatch reopens inline editor for color and label adjustments).
- **Arrange & Align (adopted by owner)**: Non-destructive multi-selection alignment
  and distribution (align left/center/right/top/middle/bottom, distribute H/V)
  with single-step batch undo, plus a manual toolbar auto-arrange grid button.
- **Node & Arrow Connections (adopted by owner)**: Directed cubic bezier arrows connecting
  cards via 4 cardinal magnetic anchor nodes. Persisted via schema-free jsonb item content.
  Seamlessly integrated with Creative Direction: promoting a canvas idea with connected
  references automatically links them into `direction_reference_links`. Includes single-step
  undo and midpoint relationship labels.
- **Freehand Pen Scribble Tool (`stroke` type)**: Freehand vector pen tool with configurable
  stroke width (2, 4, 8px) and palette/hex color selection. Employs Douglas-Peucker point
  decimation and radial filtering (`strokeUtils.ts`) to compress point data, normalizes relative
  coordinates to bounding boxes to reduce jsonb storage bloat, and directly mutates the Konva
  Line node ref during drag to eliminate React re-renders. Persisted in `moodboard_items` with
  `type: 'stroke'`.
- **Whole-Stroke Eraser Tool**: Dedicated eraser tool (`E` or `Shift+P` toggle) detecting stroke
  intersections (`isPathIntersectingStroke` / `isPointIntersectingStroke`) to soft-delete entire
  strokes upon contact, commits batch deletions on mouseup, and integrates with single-step batch
  undo (`BATCH_DELETE`) to restore deleted strokes simultaneously.
- **Canvas Direction Inspector Drawer**: Slide-over inspector panel (`CanvasDirectionInspector.tsx`)
  providing instant details for any selected canvas item, inline promotion of Idea cards into
  creative direction notes with connected references auto-linked, and bidirectional linking/unlinking
  of references directly from the canvas.
- **Card Constraints & Compression**: Locked aspect ratio during reference and image item placement
  and resizing; client-side image compression strictly bounded under 1MB storage bucket limits.
- **Zoom-Crisp Dotted Grid**: Dynamic background canvas redraw ensuring background grid dots
  remain sharp at any zoom level.
- **Bugfix against core rules**: Moodboard saves surface visible saving,
  saved, and error banner feedback in compliance with the "no silent failures" rule.

## Tech stack

**Frontend:** Next.js 14.2.35 (pinned — earlier pinned at 14.2.15, which
carried a disclosed middleware auth-bypass CVE; do not downgrade), TypeScript
(strict, no `any`), Tailwind CSS
**UI:** shadcn/ui where useful — never let it dictate the visual style
**Canvas:** react-konva / Konva.js
**Backend:** Supabase (Postgres, Auth, Storage)
**Hosting:** Vercel
**Metadata fetching:** Next.js server-side route + lightweight Open Graph
scraper (Cheerio) — no paid link-preview API

**Do not introduce** Prisma, Drizzle, Clerk, Auth.js, separate S3,
Cloudinary, microservices, or any other new service unless a real technical
requirement appears — explain the requirement before adding anything.

## Architecture

Feature/domain-oriented structure:

    src/
      app/                    # routes: auth, dashboard, projects, api
      features/
        auth/  projects/  references/  moodboard/  creative-direction/
          {components, services, hooks, types, validation}
      components/ui/  components/shared/
      lib/supabase/  lib/security/  lib/env/  lib/utils/
      config/  types/  styles/

Domain-oriented, legible to another developer picking it up cold. Every
file needs an obvious reason to exist.

## Code quality rules

- Small, focused components. No giant page components.
- No Supabase queries scattered through UI — keep data access in each
  feature's `services/`.
- Centralize validation within the owning feature; never duplicate a
  business rule across features.
- Proper loading, empty, and error states on every async view — no silent
  failures.
- Validate all user input, including URLs before server-side fetch.
- Clear naming over comments; comment only where architectural intent isn't
  obvious from the code.

## Security

- **Row Level Security on every table**, chained through project ownership.
  A cross-project integrity constraint (same-user, different-project links
  disallowed) is also in place — do not remove it.
- **Storage bucket policies too, not just tables** — same per-user,
  per-project rule applies to the `thumbnails` bucket.
- **SSRF protection on `/api/metadata` and `/api/proxy-image`** (`src/lib/security/ssrf.ts`):
  scheme allowlist, DNS pre-resolution, private/loopback/link-local IP
  blocklist, and — critically — the outgoing fetch is pinned to the
  validated IP via a custom `lookup` on the HTTP(S) agent, preventing DNS
  rebinding between check and fetch. Do not weaken this, and do not
  re-resolve the hostname at fetch time.
- **Per-IP Rate Limiting on public endpoints** (`src/lib/security/rateLimit.ts`):
  In-memory sliding-window limiter on `/api/metadata` (25 req/min) and
  `/api/proxy-image` (75 req/min). Plainly stated trade-off: this in-memory
  limiter is per-instance on serverless (Vercel), not a globally coordinated
  distributed cap across the whole app — an intentional zero-cost trade-off
  that throttles burst abuse without paid infrastructure or external databases,
  not a hard global guarantee.
- **Never commit secrets.** Keys live in `.env.local` (gitignored) and in
  Vercel's environment settings — never hardcoded, never committed.

## Database schema (as built)

    users              id, email, created_at
    projects           id, user_id, name, description, share_token (nullable),
                        created_at, updated_at
    references         id, project_id, url, title, thumbnail_url,
                        source_domain, note, tags, created_at, deleted_at (nullable)
    moodboard_items    id, project_id, reference_id (nullable), type,
                        content (jsonb), x, y, width, height, z_index,
                        created_at, updated_at, deleted_at (nullable)
                        -- type in ('reference', 'text', 'image', 'color', 'idea', 'stroke')
    direction_notes    id, project_id, title, description,
                        created_at, updated_at, deleted_at (nullable)
    direction_reference_links
                        id, direction_note_id, reference_id, created_at
                        -- unique(direction_note_id, reference_id)

    Functions / RPCs:
    get_shared_project_bundle(p_token text)
                        -- security definer, token-scoped read-only project bundle fetch

`direction_reference_links` is the core architectural requirement — many-to-
many in both directions. Do not simplify it. All schema changes go through
Supabase migrations in `supabase/migrations/`, never ad-hoc dashboard edits.

## Reference capture — fallback and storage discipline

Pinterest and Instagram block server-side scraping. On fetch failure: never
show a broken card, never fail silently — fall back to manual entry (edit
URL, enter title, optional thumbnail upload, tags, note).

Never re-host full-resolution external images. Store the external thumbnail
URL directly wherever available. Only write to Supabase Storage when no
usable thumbnail exists or the user manually uploads one — resize/compress
(~400px wide) before storing. Free tier caps storage at 1GB total.

## Moodboard canvas

react-konva, full-bleed, pan/zoom/drag/resize, persisted x/y/width/height/
z-index per item. Item types: reference, text, image, color, idea, stroke (see
"Scope adopted mid-build" above). References drag in from a collapsible
library drawer that never permanently consumes significant screen space.
Visual grouping by proximity is enough — no formal container/group system.

## Creative direction

Title, description, linked references, full create/edit/delete and
link/unlink. Selecting a note reveals its linked references; selecting a
reference reveals its linked direction notes. This bidirectional view is
the single most important user experience in the product.

## Visual direction

Quiet, spatial, tactile, editorial, fluid, premium, restrained — not a
generic AI SaaS dashboard.

**Color:** deep warm-neutral dark background, warm off-white text, muted
restrained surfaces, one accent color used sparingly for primary actions
and active/focus/selected states. No gradients, no neon "AI" colors, no
glassmorphism.

**Typography:** two roles — an editorial/expressive display face for
titles/headings, a quiet sans for UI/labels/body. Hierarchy from scale and
weight, not more font sizes.

**Spacing:** generous whitespace. No dashboard KPI cards, no
card-inside-card layouts. A card only appears when content genuinely
behaves like a card.

**Motion:** subtle, purposeful, never decorative for its own sake. Panels
slide and ease. Canvas pan/zoom/drag feels inertial, never robotic.

**Interaction study, not imitation:** Linear, Arc, Raycast for restraint;
Are.na, Cosmos, Milanote for reference-workflow thinking. Build an original
visual system.

## V1 Definition of Done — code complete, live owner verification pending

Create a project, save 15 real references (including one hitting the manual
fallback), arrange 2+ moodboard clusters, create a direction note, link 3
references, confirm the link both directions, refresh, confirm everything
persists. All features are built and passing automated builds, but this
must be personally re-run against live data by the owner before any release
is considered trustworthy — an agent-reported pass alone is not sufficient
evidence. As of this audit, owner verification against live data has not
been recorded.

## Phase 2 scope — fully implemented in codebase (owner live verification pending)

1. **Trust & safety:** soft delete (`deleted_at` column) + restore/Trash
   view (`TrashModal`) for references, direction notes, and moodboard items.
   One-level undo for canvas actions (`ADD`, `DELETE`, `MOVE`, `RESIZE`,
   `DUPLICATE`, `BATCH_MOVE`, `BATCH_DELETE`).
2. **Quality of life:** command palette (Cmd/Ctrl+K) for navigation and
   creation; multi-select + bulk tag/delete in the reference library;
   canvas keyboard shortcuts (delete, duplicate, arrow-key nudge,
   zoom-to-fit, spacebar-pan); client-side color palette extraction from
   reference thumbnails (algorithmic, in-browser, no external API).
3. **Export:** moodboard-as-PNG (`stage.toDataURL`), direction-note-as-PDF
   (`DirectionExportPdfModal` with clean `@media print` layout).
4. **Light sharing:** single read-only, revocable share link per project
   using token-scoped `get_shared_project_bundle` RPC (bypasses RLS securely
   without leaking project listings or requiring service role keys).
   No comments or approval workflows yet — that's explicitly deferred
   until real usage asks for it.

Full step-by-step build detail for Phase 2 lives in the Phase 2 kickoff
prompt, not duplicated here.

## Explicitly out of scope until real usage justifies it

Comments/approvals on the share link, multiple moodboards per project,
AI tagging, AI analysis, embeddings, semantic search, design critique,
brand identity as a separate module (it extends direction notes instead —
see Phase 3), design version uploads, teams/roles/collaboration,
notifications, dashboard analytics, browser extension, mobile app, offline
mode. These are deliberately deferred, not forgotten — see the Master
Project Document for the reasoning behind each.

## Technical debt & architecture backlog

- **`MoodboardStage.tsx` & `useMoodboard.ts` modularization**: `MoodboardStage.tsx` (~68 KB / 1,700 lines) and `useMoodboard.ts` (~42 KB / 1,100 lines) have concentrated multiple canvas responsibilities (Konva stage management, marquee math, gesture handlers, connector arrows, pen drawing, eraser math, keyboard shortcuts, drawer/file drag-and-drop, PNG serialization). Flagged for future refactoring once live verification and immediate bugfixes (PNG export CORS-taint proxy) are resolved. Target: decompose into focused custom hooks (`useCanvasGestures`, `useCanvasKeyboardShortcuts`, `useConnectorTopology`) and modular stage layers without altering visual behavior.

## Hard rule — effective since the mid-build scope incident, still in force

No new feature, item type, database column, table, or migration — however
small, however "obviously useful" — gets built without the owner explicitly
approving a written plan for it first. Propose, stop, and wait for an
explicit go-ahead in a following message. If unsure whether something counts
as new scope versus an implementation detail within already-approved scope,
treat it as new scope and ask.

## How to work

For every step in an approved phase: propose the exact plan (files, schema
changes, libraries), stop, wait for explicit approval, implement, run
typecheck/lint/build, manually verify the behavior, commit with a clear
message, then propose the next step. Do not batch multiple steps into one
uninterrupted pass. Do not rewrite working architecture unless necessary.
If a requirement in this file is ambiguous, ask rather than assume.

## Verification

After each step: run the dev server, typecheck, lint, fix everything that
surfaces, check for console errors, manually exercise the flow you built.
No broken imports, no TypeScript errors, no leftover placeholder logic
once real functionality exists.

## Git discipline

Commit and push after each individually verified step, not per whole phase — this is
the rollback safety net for a solo, zero-budget build.

**Standing rule for reporting**: Work is never done until pushed to the remote. Before
writing any "walkthrough" or "implementation summary" for the owner, always push the
commits, fetch origin/main (`git fetch && git log origin/main -n 1 --oneline`), and
include that exact output at the top of the report as verified confirmation that origin/main
matches local.