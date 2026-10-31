# 乐启享大屏展示系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally deployable touch-screen display/PWA for 乐启享 with dashboard browsing, guided consultation tours, mixed media autoplay, local content configuration, and offline-friendly assets.

**Architecture:** A React + TypeScript + Vite app reads local JSON content from `public/content`, renders a 16:9 touch-first big-screen experience, and uses small pure TypeScript services for content validation, tour progression, and playlist playback. Import scripts copy website media and render PDF pages into `public/assets` so runtime does not depend on remote services.

**Tech Stack:** React, TypeScript, Vite, Vitest, CSS variables, Node scripts, Python/PyMuPDF for PDF rendering.

---

## File Structure

- `package.json`: scripts and dependencies.
- `index.html`, `vite.config.ts`, `tsconfig*.json`: Vite project setup.
- `src/main.tsx`, `src/App.tsx`: app entry and top-level state.
- `src/types/content.ts`: content schema types.
- `src/lib/content.ts`: content fetching and normalization.
- `src/lib/content.test.ts`: content validation tests.
- `src/lib/tour.ts`: guided route state transitions.
- `src/lib/tour.test.ts`: tour behavior tests.
- `src/lib/playlist.ts`: carousel playlist item selection and duration rules.
- `src/lib/playlist.test.ts`: playlist behavior tests.
- `src/components/*.tsx`: dashboard, modules, tours, carousel, media frame, navigation.
- `src/styles.css`: big-screen visual system.
- `public/content/*.json`: local content seed files.
- `public/assets/**`: copied website media and rendered PDF pages.
- `scripts/import-assets.mjs`: copy selected website assets and generate content references.
- `scripts/render-pdf-pages.py`: render key PDF pages into local assets.
- `scripts/validate-content.mjs`: verify JSON references point to existing files.

## Task 1: Project Setup and Tests

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/test/setup.ts`

- [ ] Step 1: Create Vite/React/Vitest configuration.
- [ ] Step 2: Run `npm install`.
- [ ] Step 3: Run `npm test -- --run`; expected initial test command succeeds when no tests or fails only because tests are not written yet.

## Task 2: Content Schema and Validation

**Files:**
- Create: `src/types/content.ts`
- Create: `src/lib/content.test.ts`
- Create: `src/lib/content.ts`

- [ ] Step 1: Write failing tests for enabled modules, asset source validation, and graceful missing optional arrays.
- [ ] Step 2: Run `npm test -- --run src/lib/content.test.ts`; expected fail because `normalizeContentBundle` does not exist.
- [ ] Step 3: Implement `normalizeContentBundle`, `getEnabledModules`, and `isDisplayableAsset`.
- [ ] Step 4: Re-run the test file; expected pass.

## Task 3: Tour Engine

**Files:**
- Create: `src/lib/tour.test.ts`
- Create: `src/lib/tour.ts`

- [ ] Step 1: Write failing tests for first node, next, previous, pause/play, and route completion.
- [ ] Step 2: Run `npm test -- --run src/lib/tour.test.ts`; expected fail because tour engine is missing.
- [ ] Step 3: Implement pure tour state helpers.
- [ ] Step 4: Re-run the test file; expected pass.

## Task 4: Playlist Engine

**Files:**
- Create: `src/lib/playlist.test.ts`
- Create: `src/lib/playlist.ts`

- [ ] Step 1: Write failing tests for filtering disabled/expired items, default durations, and wraparound.
- [ ] Step 2: Run `npm test -- --run src/lib/playlist.test.ts`; expected fail because playlist engine is missing.
- [ ] Step 3: Implement pure playlist helpers.
- [ ] Step 4: Re-run the test file; expected pass.

## Task 5: Seed Local Content

**Files:**
- Create: `public/content/site.json`
- Create: `public/content/modules.json`
- Create: `public/content/courses.json`
- Create: `public/content/tours.json`
- Create: `public/content/playlists.json`
- Create: `public/content/pricing.json`
- Create: `public/content/achievements.json`
- Create: `public/content/students.json`
- Create: `public/content/staff.json`
- Create: `public/content/assets.json`

- [ ] Step 1: Seed content from the confirmed design and website course data summary.
- [ ] Step 2: Keep student content empty but enabled with privacy messaging.
- [ ] Step 3: Include PDF/website/generated/manual source metadata in asset entries.

## Task 6: Asset Import Tools

**Files:**
- Create: `scripts/import-assets.mjs`
- Create: `scripts/render-pdf-pages.py`
- Create: `scripts/validate-content.mjs`

- [ ] Step 1: Implement website media copying for logo, classroom/activity/course images, and videos.
- [ ] Step 2: Implement PDF page rendering for selected key pages.
- [ ] Step 3: Implement content reference validation.
- [ ] Step 4: Run import and validation scripts.

## Task 7: Big-Screen UI

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/components/Dashboard.tsx`
- Create: `src/components/ModuleView.tsx`
- Create: `src/components/TourPlayer.tsx`
- Create: `src/components/PlaylistPlayer.tsx`
- Create: `src/components/MediaFrame.tsx`
- Create: `src/components/TopBar.tsx`
- Create: `src/styles.css`

- [ ] Step 1: Render loading/error states from content loader.
- [ ] Step 2: Render homepage dashboard with guide routes and module entrances.
- [ ] Step 3: Render all modules with content-driven sections.
- [ ] Step 4: Render tour player controls.
- [ ] Step 5: Render playlist player with mixed item types.
- [ ] Step 6: Add idle timeout to enter autoplay mode.

## Task 8: Offline and Deployment

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `src/registerServiceWorker.ts`
- Create: `public/sw.js`
- Modify: `src/main.tsx`

- [ ] Step 1: Register manifest and service worker.
- [ ] Step 2: Cache app shell and content JSON.
- [ ] Step 3: Keep media URLs local and browser-cacheable.

## Task 9: Verification

**Files:**
- No new files required.

- [ ] Step 1: Run `npm test -- --run`.
- [ ] Step 2: Run `npm run build`.
- [ ] Step 3: Run `npm run validate:content`.
- [ ] Step 4: Start local server with `npm run dev -- --host 127.0.0.1`.
- [ ] Step 5: Open the local URL and verify dashboard, tour, module, and carousel flows.

## Self-Review

- Spec coverage: The plan covers local PWA, touch dashboard, modules, tours, playlist, content files, local assets, PDF rendering, privacy boundaries, and verification.
- Placeholder scan: No task relies on undefined future scope; second-version admin CMS is intentionally excluded from first implementation.
- Type consistency: Content, tour, and playlist types are defined before UI consumes them.

