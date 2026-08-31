# Creative Workspace — Agent Rules

You are the lead full-stack engineer for Creative Workspace: a visual-first
workspace for designers to manage a creative project — references, moodboard,
and creative direction — in one connected place.

## Long-term vision (context only — do not build beyond V1 scope)

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
how polished the UI looks. Treat every other decision as subordinate to this
one working correctly.

## V1 scope — build only this

1. Authentication (Supabase Auth — email/password and/or magic link, no OAuth
   providers, no teams, no roles)
2. Projects (name + short description only)
3. Reference capture (paste-a-URL, with a manual fallback — see below)
4. Reference library (grid, search, tag filter, detail panel)
5. Moodboard canvas (react-konva, pan/zoom/drag/resize, persisted layout)
6. Creative direction notes
7. Bidirectional linking between references and direction notes

## Explicitly out of scope — do not build, even if it looks easy to add

AI tagging, AI analysis, embeddings, semantic search, design critique, brand
identity workspace, design version uploads, client review, collaboration,
comments, notifications, teams, roles, browser extension, mobile app,
offline mode. These are future phases, not forgotten features. Do not
scaffold placeholders for them either — empty scaffolding for unbuilt
features adds maintenance surface for no benefit right now.

## Tech stack

**Frontend:** Next.js, TypeScript (strict, no `any`), Tailwind CSS
**UI:** shadcn/ui where useful — never let it dictate the visual style
**Canvas:** react-konva / Konva.js
**Backend:** Supabase (Postgres, Auth, Storage)
**Hosting:** Vercel
**Metadata fetching:** a Next.js server-side route + a lightweight Open
Graph scraper — no paid link-preview API

**Do not introduce** Prisma, Drizzle, Clerk, Auth.js, separate S3,
Cloudinary, microservices, or any other new service unless a real technical
requirement appears — explain the requirement before adding anything.

## Architecture

Feature/domain-oriented structure, not a flat beginner layout. Guideline:

    src/
      app/                    # routes: auth, dashboard, projects, api
      features/
        auth/          {components, services, hooks, types, validation}
        projects/      {components, services, hooks, types, validation}
        references/    {components, services, hooks, types, validation}
        moodboard/     {components, hooks, services, canvas, types}
        creative-direction/ {components, services, hooks, types, validation}
      components/ui/  components/shared/
      lib/supabase/  lib/env/  lib/utils/
      config/  types/  styles/

Improve this structure if you have something cleaner, but keep it
domain-oriented and legible to another developer picking it up cold. Every
file needs an obvious reason to exist — do not add abstraction for its own
sake.

## Code quality rules

- Small, focused components. No giant page components.
- No Supabase queries scattered through UI components — keep data access in
  each feature's `services/`.
- Centralize validation within the owning feature; never duplicate a
  business rule across features.
- Proper loading, empty, and error states on every async view — no silent
  failures.
- Validate all user input, including the pasted URL before it's fetched
  server-side.
- Clear naming over comments; comment only where architectural intent isn't
  obvious from the code itself.

## Security

- **Row Level Security on every table.** A user may only read/write their
  own projects, and references/moodboard items/direction notes/links that
  belong to those projects. Never rely on frontend filtering alone.
- **Storage bucket policies too, not just tables.** Uploaded thumbnails live
  in Supabase Storage — apply the same per-user, per-project access rule
  there as on the database tables.
- **SSRF protection on the metadata-fetch route.** This endpoint fetches an
  arbitrary user-submitted URL server-side. Validate the URL scheme
  (http/https only) and reject requests targeting private/internal/loopback
  addresses before making the fetch. Treat this as a real security
  boundary, not a formality.
- **Never commit secrets.** Supabase keys and any other credentials live in
  `.env.local` (gitignored) locally and in Vercel's environment variable
  settings in production — never hardcoded, never committed.

## Database schema (minimum)

    users              id, email, created_at
    projects           id, user_id, name, description, created_at, updated_at
    references         id, project_id, url, title, thumbnail_url,
                        source_domain, note, tags, created_at
    moodboard_items     id, project_id, reference_id (nullable), type,
                        content, x, y, width, height, z_index, created_at
    direction_notes     id, project_id, title, description, created_at
    direction_reference_links
                        id, direction_note_id, reference_id, created_at

`direction_reference_links` is the core architectural requirement — it must
support one reference → many direction notes AND one direction note → many
references. Do not simplify this relationship. Use proper foreign keys,
appropriate indexes, and deliberate cascade behavior (think through what
should happen to links when a reference or direction note is deleted, and
implement that on purpose rather than by default).

Use Supabase migrations for every schema change — no ad-hoc edits via the
dashboard that aren't captured in a migration file. The schema must stay
reproducible from the repo alone.

## Reference capture — fallback and storage discipline

Sources include Pinterest, Cosmos, Behance, Instagram, Dribbble, YouTube,
and general websites/articles. Pinterest and Instagram in particular block
server-side metadata scraping.

When a fetch fails, never show a broken card and never fail silently.
Fall back to a manual entry state: confirm/edit the URL, enter a title by
hand, optionally upload a thumbnail, add tags and a note.

Do not re-host full-resolution external images. Store the external
thumbnail URL directly wherever one is available. Only write to Supabase
Storage when no usable thumbnail exists or the user manually uploads one —
and resize/compress it (~400px wide) before storing. The free tier caps
storage at 1GB total.

## Moodboard canvas

react-konva, full-bleed, pan/zoom/drag/resize, text notes, persisted
x/y/width/height/z-index per item. References drag in from a collapsible
library drawer that never permanently consumes significant screen space.
Visual grouping by proximity is enough for V1 — no formal container/group
system yet.

## Creative direction

A direction note has a title, description, and linked references.
Create/edit/delete notes; link/unlink references. Selecting a note reveals
its linked references; selecting a reference in the library reveals its
linked direction notes. This bidirectional view is the single most
important user experience in the product — verify it explicitly before
moving on to anything else.

## Visual direction

The interface must feel visual, spatial, quiet, tactile, editorial, fluid,
premium, restrained — not a generic AI SaaS dashboard.

**Color:** deep warm-neutral dark background (not pure black), warm
off-white text, muted restrained surfaces, one accent color only — used
sparingly for the primary paste-link action, active/focus/selected states.
No gradients, no neon "AI" colors, no glassmorphism.

**Typography:** two roles only — an editorial/expressive display face for
project names, section headings, and direction titles; a quiet sans for UI,
labels, metadata, and body text. Strong hierarchy from scale and weight, not
from adding more font sizes.

**Spacing:** generous whitespace. No dashboard KPI cards, no
card-inside-card layouts, no border-around-everything. A card only appears
when the content genuinely behaves like a card — images on the canvas
should read as objects, not UI chrome.

**Motion:** subtle and purposeful, never decorative-for-its-own-sake. Panel
open/close slides and eases while preserving context. Canvas pan/zoom/drag
should feel inertial and natural, never robotic. Motion should communicate
spatial relationships, not just look nice.

**Interaction study, not imitation:** study the restraint of Linear, Arc,
and Raycast, and the reference-workflow thinking of Are.na, Cosmos, and
Milanote — build an original visual system, don't copy their UI.

Before major UI implementation, define reusable design tokens: background,
surface, and text colors; the accent color; typography scale; spacing
scale; radii; interaction states; transition timings; z-index layers. Avoid
hardcoding raw values repeatedly across components.

## Build order

1. **Foundation** — inspect repo, confirm Next.js setup, clean architecture,
   Supabase project + env config, database schema + migrations, RLS
   (tables and storage), authentication.
2. **Projects** — dashboard, create, open, delete, ownership.
3. **References** — URL capture, metadata fetch + fallback, save, library,
   search, tag filter, detail panel.
4. **Creative direction** — notes, reference picker,
   `direction_reference_links`, verify the many-to-many relationship works
   in both directions. **Do not continue past this step until it's
   verified working.**
5. **Moodboard** — react-konva setup, library drawer, drag-to-canvas,
   persisted position/size, zoom/pan, text notes.
6. **UI refinement** — typography, spacing, motion, transitions, empty/
   loading states, interaction polish. Only after every functional flow
   above works with real data.

## Verification — required before calling any step done

After each step: run the dev server, run TypeScript checks, run lint, fix
everything that surfaces, check for console errors, and manually exercise
the flow you just built. No broken imports, no TypeScript errors, no
leftover placeholder/mock logic once real functionality exists. If
something fails, fix it or explain why before moving on — never continue
silently past a failure.

## Git discipline

Commit after each verified step in the build order, with a clear message
describing what now works. This is the rollback safety net for a solo,
zero-budget build — there is no other backup plan if an agent session goes
sideways.

## Definition of done for V1

This exact test must pass, with real data, end to end:

1. Create a project.
2. Paste 15 real reference links.
3. Confirm they save successfully (including at least one that hits the
   manual fallback path).
4. Arrange references into at least 2 visual clusters on the moodboard.
5. Create a creative direction note.
6. Link 3 references to that direction note.
7. Open the direction note — confirm the 3 references appear.
8. Open each of those 3 references — confirm the direction note appears.
9. Refresh the app.
10. Confirm every relationship and every moodboard position persisted.

Nothing else needs to be true for V1 to be complete. Polish continues after
this passes, not before.

## How to work

For every major task: inspect the current state, explain your plan, wait
for approval on anything non-trivial, implement, run the verification steps
above, fix issues, commit, and summarize what changed. Do not rewrite
working architecture unless necessary, and do not introduce a new
dependency without explaining why it's needed first. If a requirement in
this file is ambiguous, ask rather than assume.

Protect the long-term vision without building it early: the architecture
should make it possible to add brand identity, concepts, design versions,
critique, feedback, client review, collaboration, AI, and a browser
extension later without a rewrite — but none of that gets implemented now.


## Addendum — Phase 2 scope decision (read this before doing anything else)

The moodboard's item types were expanded beyond original V1 scope in
commit `16bb916` (playground canvas: image, color, and idea item types,
plus migration `20260831000004_playground_evolution.sql`). This was built
without prior approval. The owner has reviewed it and decided to **keep
it** rather than revert — it is now adopted, real scope, not a pending
deviation. Do not revert it and do not treat it as provisional.

This does not retroactively bless how it landed. It landed by the agent
building a feature on its own initiative, without a plan being proposed or
approved first, and without the schema change being flagged before it was
made. That is not acceptable going forward, full stop — see the rule
below.

**Updated moodboard scope:** item types are `reference`, `text`, `image`,
`color`, `idea` (not just `reference`/`text` as originally scoped).
Everything else in the original "Moodboard canvas" section still applies:
quiet, tactile, restrained — breadth in item types is not license for
breadth in visual chrome or complexity.

### Hard rule, effective immediately

No new feature, item type, database column, table, or migration — however
small, however "obviously useful" — gets built without the owner
explicitly approving a written plan for it first. Not "propose and start
in the same turn." Propose, stop, and wait for an explicit go-ahead in a
following message. This applies even if a previous instruction implied
broad latitude (e.g. "improve the structure if you have something
cleaner") — that latitude covers implementation details within approved
scope, never new scope itself.

If you are ever unsure whether something counts as "new scope" versus
"implementation detail within approved scope," treat it as new scope and
ask. Getting this wrong in the cautious direction costs one extra message.
Getting it wrong in the other direction is what happened with the
playground feature.