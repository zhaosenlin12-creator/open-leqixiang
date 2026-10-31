# 乐启享空间剧场大屏重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing kiosk as the selected full-screen Spatial Stage design with autoplay media, category navigation, an orbiting student gallery, and layered detail drawers.

**Architecture:** Keep the existing React + TypeScript + Vite shell and local PWA assets, replace the dashboard view with one top-level exhibition state machine, and isolate deterministic carousel/orbit calculations in pure TypeScript helpers. Curated, UTF-8 display data lives in a focused source module while all media remains local under `public/assets`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Lucide React, CSS transforms and transitions, local image/video/PDF assets.

---

## File Structure

- `src/data/exhibition.ts`: clean navigation, slides, student stories, courses, staff capabilities, honors, and institution content.
- `src/lib/exhibition.ts`: pure wraparound index, relative orbit slot, and idle destination helpers.
- `src/lib/exhibition.test.ts`: behavior tests for carousel and orbit navigation.
- `src/components/ExhibitionHeader.tsx`: brand navigation and media controls.
- `src/components/HeroCarousel.tsx`: full-screen autoplay image/video stage and timeline controls.
- `src/components/OrbitGallery.tsx`: reusable perspective carousel with pause and selection behavior.
- `src/components/CategoryStage.tsx`: artistic category shell for students, courses, staff, honors, and institution.
- `src/components/LayeredDrawer.tsx`: accessible stacked detail drawer.
- `src/App.tsx`: exhibition state, idle return, selected item, and full-screen coordination.
- `src/styles.css`: complete Spatial Stage visual system and responsive rules.
- `index.html`: corrected title and black launch background.
- `docs/reference/leqixiang-spatial-stage-reference.png`: selected visual target used for QA.
- `design-qa.md`: comparison evidence and final QA result.

### Task 1: Pure Exhibition Navigation

**Files:**
- Create: `src/lib/exhibition.test.ts`
- Create: `src/lib/exhibition.ts`

- [ ] **Step 1: Write failing tests**

```ts
expect(wrapIndex(-1, 5)).toBe(4);
expect(wrapIndex(5, 5)).toBe(0);
expect(relativeOrbitSlot(4, 0, 5)).toBe(-1);
expect(nextIndex(4, 5, 1)).toBe(0);
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/lib/exhibition.test.ts`
Expected: FAIL because `./exhibition` does not exist.

- [ ] **Step 3: Implement the pure helpers**

```ts
export function wrapIndex(index: number, length: number): number;
export function nextIndex(index: number, length: number, delta?: number): number;
export function relativeOrbitSlot(index: number, activeIndex: number, length: number): number;
```

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- --run src/lib/exhibition.test.ts`
Expected: all exhibition helper tests pass.

### Task 2: Curated Local Exhibition Content

**Files:**
- Create: `src/data/exhibition.ts`
- Copy: selected visual target to `docs/reference/leqixiang-spatial-stage-reference.png`

- [ ] **Step 1: Define typed content records** for navigation, hero slides, orbit stories, courses, honors, staff capabilities, and institution drawers.
- [ ] **Step 2: Reference only local assets** already present in `public/assets`; use public activity images for anonymous student stories and keep unreviewed archive images out of the module.
- [ ] **Step 3: Scan visible data** with `rg` for replacement characters and known mojibake fragments.

### Task 3: Full-Screen Carousel and Navigation

**Files:**
- Create: `src/components/ExhibitionHeader.tsx`
- Create: `src/components/HeroCarousel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Render the header and hero** from the curated content with active navigation state.
- [ ] **Step 2: Implement autoplay, previous/next, pause/play, mute, fullscreen, progress, and video-ended behavior.**
- [ ] **Step 3: Implement idle return** to the homepage after the configured timeout.
- [ ] **Step 4: Run tests and TypeScript build** to catch state and prop contract errors.

### Task 4: Orbit Gallery and Category Stages

**Files:**
- Create: `src/components/OrbitGallery.tsx`
- Create: `src/components/CategoryStage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Use `relativeOrbitSlot`** to place cards along the horizontal perspective arc.
- [ ] **Step 2: Add timed rotation** and pause on pointer hover, focus-within, touch interaction, or open drawer.
- [ ] **Step 3: Add keyboard and button navigation** with stable dimensions and visible focus.
- [ ] **Step 4: Render five category compositions** using real local content and media.

### Task 5: Layered Detail Drawer

**Files:**
- Create: `src/components/LayeredDrawer.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Implement stacked rails and an active panel** with title, local media, text, tags, and adjacent-item controls.
- [ ] **Step 2: Support close button, backdrop click, and Escape.**
- [ ] **Step 3: Keep focus and aria labels usable** for touch, mouse, and keyboard.

### Task 6: Spatial Stage Styling

**Files:**
- Replace: `src/styles.css`
- Modify: `index.html`

- [ ] **Step 1: Implement the 1920x1080 composition** with ink background, blue/yellow/orange rails, media scrims, large Chinese display type, and exact bottom orbit proportions.
- [ ] **Step 2: Add responsive rules** for 1366x768 and compact horizontal touch displays.
- [ ] **Step 3: Add reduced-motion behavior** and remove all old dashboard selectors from the rendered path.

### Task 7: Automated Verification

**Files:**
- Modify: tests only when a failing behavior requires a regression case.

- [ ] **Step 1:** Run `npm test -- --run`; expected 0 failures.
- [ ] **Step 2:** Run `npm run build`; expected exit 0.
- [ ] **Step 3:** Run `npm run validate:content`; expected no missing local references.
- [ ] **Step 4:** Run a source scan for visible mojibake and remote media URLs.

### Task 8: Browser and Design QA

**Files:**
- Create: `design-qa.md`
- Create: `output/browser/spatial-stage-home.png`
- Create: `output/browser/spatial-stage-students.png`
- Create: `output/browser/spatial-stage-drawer.png`
- Create: `output/browser/spatial-stage-comparison.png`

- [ ] **Step 1: Start the local Vite server** and open it with the Browser skill at 1920x1080.
- [ ] **Step 2: Verify controls and states** including navigation, hover pause, card movement, drawer open/close, fullscreen request path, and home autoplay.
- [ ] **Step 3: Capture source and implementation** in the same comparison artifact.
- [ ] **Step 4: Fix every P0/P1/P2 mismatch** and repeat capture.
- [ ] **Step 5: Save `design-qa.md`** with `final result: passed` only when no actionable P0/P1/P2 issues remain.

## Self-Review

- Spec coverage: homepage carousel, category navigation, orbiting student cards, hover pause, click enlargement, layered drawers, local content, touch support, idle autoplay, and QA are all mapped to tasks.
- Placeholder scan: no task uses TBD content or remote placeholder media.
- Type consistency: all components consume the same `ExhibitionItem` and `SectionId` contracts defined in `src/data/exhibition.ts`; orbit helpers are defined before component use.

