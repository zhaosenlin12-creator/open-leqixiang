/**
 * Runtime loader for the student photo manifest. The manifest is a single
 * small JSON file that the server builds from public/images/students/ —
 * fetching it at startup gives the SPA an authoritative "which photos
 * exist" view without forcing Vite to bundle 150+ filenames into the
 * initial JS chunk.
 *
 * Consumers:
 *   - StudentGallery: triggers a prefetch on mount so the lazy <img>
 *     nodes only request paths the server actually has.
 *   - StudentArchivePrefetch: an opt-in component used as a <link>-style
 *     preload hint for the currently-active student card.
 */

export interface StudentArchiveManifest {
  generatedAt: string;
  count: number;
  files: string[];
}

const MANIFEST_URL = "/students-manifest.json";
const STORAGE_KEY = "leqx.studentManifest.v1";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

let inflight: Promise<StudentArchiveManifest> | null = null;
let cached: StudentArchiveManifest | null = null;
const knownFiles = new Set<string>();

function applyManifest(manifest: StudentArchiveManifest): void {
  cached = manifest;
  for (const file of manifest.files) knownFiles.add(file);
}

function readSessionCache(): StudentArchiveManifest | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; manifest: StudentArchiveManifest };
    if (!parsed?.manifest || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > STORAGE_TTL_MS) return null;
    return parsed.manifest;
  } catch {
    return null;
  }
}

function writeSessionCache(manifest: StudentArchiveManifest): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ts: Date.now(), manifest })
    );
  } catch {
    /* sessionStorage may be full or disabled; ignore */
  }
}

export async function loadStudentManifest(): Promise<StudentArchiveManifest> {
  if (cached) return cached;
  const fromSession = readSessionCache();
  if (fromSession) {
    applyManifest(fromSession);
    return fromSession;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(MANIFEST_URL, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`manifest http ${res.status}`);
      const data = (await res.json()) as StudentArchiveManifest;
      if (!Array.isArray(data.files)) throw new Error("manifest shape invalid");
      applyManifest(data);
      writeSessionCache(data);
      return data;
    } catch (err) {
      // Keep the app usable when offline / first paint before the JSON
      // arrives: the existing <img loading="lazy"> fallbacks still work,
      // and the browser will 404 any path the manifest later reports as
      // missing.
      // eslint-disable-next-line no-console
      console.warn("[studentArchive] manifest fetch failed", err);
      const empty: StudentArchiveManifest = { generatedAt: "", count: 0, files: [] };
      cached = empty;
      return empty;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function isKnownStudentFile(file: string): boolean {
  return knownFiles.size > 0 ? knownFiles.has(file) : true;
}

/**
 * Fire-and-forget prefetch. Safe to call multiple times.
 */
export function prefetchStudentManifest(): void {
  void loadStudentManifest();
}

/**
 * Insert a <link rel="preload" as="image"> hint for one photo. The hint
 * is added to <head> exactly once per path; calling it again is a no-op.
 * Intended for the active student card so the next-click feels instant
 * without us shipping a 4MB original up front.
 */
const PRELOADED = new Set<string>();

export function preloadStudentImage(mediaPath: string): void {
  if (!mediaPath || PRELOADED.has(mediaPath)) return;
  if (typeof document === "undefined") return;
  PRELOADED.add(mediaPath);
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = mediaPath;
  link.fetchPriority = "high";
  // Some browsers honour crossorigin on <link preload>; harmless when omitted.
  document.head.appendChild(link);
}


interface ThumbsManifest {
  generatedAt: string;
  count: number;
  entries: { file: string; thumb: string; large: string }[];
}
const THUMBS_URL = "/students-thumbs-manifest.json";
const THUMBS_KEY = "leqx.studentThumbsManifest.v1";
let thumbsInflight: Promise<ThumbsManifest | null> | null = null;
let thumbsByFile: Map<string, { thumb: string; large: string }> | null = null;

export async function loadThumbsManifest(): Promise<ThumbsManifest | null> {
  if (thumbsByFile) return { generatedAt: "", count: thumbsByFile.size, entries: [] };
  if (thumbsInflight) return thumbsInflight;
  thumbsInflight = (async () => {
    try {
      const sessionRaw = (typeof sessionStorage !== "undefined") ? sessionStorage.getItem(THUMBS_KEY) : null;
      let data: ThumbsManifest | null = null;
      if (sessionRaw) {
        try { data = JSON.parse(sessionRaw); } catch { data = null; }
      }
      if (!data) {
        const res = await fetch(THUMBS_URL, { credentials: "same-origin" });
        if (!res.ok) throw new Error("thumbs http " + res.status);
        data = (await res.json()) as ThumbsManifest;
        if (typeof sessionStorage !== "undefined") {
          try { sessionStorage.setItem(THUMBS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
        }
      }
      const m = new Map<string, { thumb: string; large: string }>();
      for (const e of data.entries) m.set(e.file, { thumb: e.thumb, large: e.large });
      thumbsByFile = m;
      return data;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[studentArchive] thumbs manifest failed", err);
      thumbsByFile = new Map();
      return null;
    } finally {
      thumbsInflight = null;
    }
  })();
  return thumbsInflight;
}

/**
 * Translate a "/images/students/<name>.jpg" path into the smaller
 * "/students/thumb/<name>.webp" variant if a thumb has been generated.
 * Returns null when no manifest is loaded yet or when the source file
 * is not part of the archive (e.g. an SVG or pre-baked webp asset).
 */
/**
 * Normalise a media path into the canonical "images/<section>/<name>" form
 * (no leading slash). The post-build relativize step rewrites "/images/..."
 * literals into "./images/...", so this resolver must accept absolute,
 * relative and bare forms without depending on literals the postbuild pass
 * rewrites. Returning a slash-free key keeps every lookup here stable no
 * matter how the bundle is deployed.
 */
function normalizeMediaPath(mediaPath: string): string | null {
  if (!mediaPath) return null;
  let p = mediaPath;
  if (p.startsWith("./")) p = p.slice(2);
  else if (p.startsWith("/")) p = p.slice(1);
  if (!p.startsWith("images/")) return null;
  return p;
}

export function resolveStudentThumb(mediaPath: string): string | null {
  const p = normalizeMediaPath(mediaPath);
  if (!p || !p.startsWith("images/students/")) return null;
  const file = p.slice("images/students/".length);
  const m = thumbsByFile?.get(file);
  if (m) return m.thumb;
  // Manifest still loading or this asset is not archived; kick a load so
  // the next render call can succeed.
  void loadThumbsManifest();
  return null;
}

export function prefetchStudentThumbs(): void {
  void loadThumbsManifest();
}


/**
 * Schedule a low-priority preload of the first N student thumbnails.
 * Intended to be called once after the home page is interactive so the
 * gallery mounts with warm images. Uses requestIdleCallback where
 * available, falling back to setTimeout in browsers that lack it.
 */
export function warmStudentGallery(idleDeadlineMs = 1500, count = 8): void {
  const run = () => {
    void loadThumbsManifest().then((manifest) => {
      if (!manifest) return;
      for (const e of manifest.entries.slice(0, count)) {
        const img = new Image();
        img.loading = "eager" as const;
        img.decoding = "async" as const;
        img.src = e.thumb;
      }
    });
  };
  if (typeof window === "undefined") return;
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === "function") {
    ric(run, { timeout: idleDeadlineMs });
  } else {
    window.setTimeout(run, Math.min(idleDeadlineMs, 500));
  }
}


/**
 * Generic resolver used by HeroCarousel / CategoryStage / OrbitGallery
 * for any "/images/<section>/<name>.{jpg,png,webp}" media path. Looks
 * the path up in the build-time-generated sections-thumbs-manifest and
 * returns the matching /<section>/thumb/<name>.webp entry, or null
 * when no thumb has been generated for the asset.
 */
interface SectionThumbsEntry { section: string; file: string; thumb: string; large: string }
interface SectionThumbsManifest { generatedAt: string; count: number; entries: SectionThumbsEntry[] }
const SECTIONS_URL = "/sections-thumbs-manifest.json";
const SECTIONS_KEY = "leqx.sectionsThumbsManifest.v1";
let sectionsInflight: Promise<SectionThumbsManifest | null> | null = null;
let sectionThumbs: Map<string, string> | null = null;

export async function loadSectionThumbs(): Promise<SectionThumbsManifest | null> {
  if (sectionThumbs) return { generatedAt: "", count: sectionThumbs.size, entries: [] };
  if (sectionsInflight) return sectionsInflight;
  sectionsInflight = (async () => {
    try {
      const sessionRaw = (typeof sessionStorage !== "undefined") ? sessionStorage.getItem(SECTIONS_KEY) : null;
      let data: SectionThumbsManifest | null = null;
      if (sessionRaw) {
        try { data = JSON.parse(sessionRaw); } catch { data = null; }
      }
      if (!data) {
        const res = await fetch(SECTIONS_URL, { credentials: "same-origin" });
        if (!res.ok) throw new Error("sections thumbs http " + res.status);
        data = (await res.json()) as SectionThumbsManifest;
        if (typeof sessionStorage !== "undefined") {
          try { sessionStorage.setItem(SECTIONS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
        }
      }
      const m = new Map<string, string>();
      for (const e of data.entries) m.set("images/" + e.section + "/" + e.file, e.thumb);
      sectionThumbs = m;
      return data;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[studentArchive] sections thumbs manifest failed", err);
      sectionThumbs = new Map();
      return null;
    } finally {
      sectionsInflight = null;
    }
  })();
  return sectionsInflight;
}

export function resolveSectionThumb(mediaPath: string): string | null {
  const p = normalizeMediaPath(mediaPath);
  if (!p) return null;
  const m = sectionThumbs?.get(p);
  if (m) return m;
  void loadSectionThumbs();
  return null;
}

export function prefetchSectionThumbs(): void {
  void loadSectionThumbs();
}
