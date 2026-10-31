/**
 * Runtime poster extraction for HTMLVideoElement. The browser already
 * loads the video for autoplay; capturing the first decoded frame into
 * a data URL and caching it in localStorage lets subsequent navigations
 * show a still cover without re-decoding — and the data is reused as
 * a CSS background-image for drawer / hero overlays so users on slow
 * networks see something during the few hundred ms before the video
 * actually paints.
 *
 *   await extractPoster(src)  → dataURL | null
 *
 * Cache key: "leqx.poster.v1.<src>". Thumbnails are tiny
 * (target 0.5 MB each); evicting is left to the host’s storage budget.
 */

const CACHE_PREFIX = "leqx.poster.v1.";
const CACHE_BYTES_BUDGET = 4 * 1024 * 1024; // 4 MB total across all posters
const FALLBACK_QUALITY = 0.72;

interface CacheIndex {
  keys: string[];
}

function indexKey(): string {
  return CACHE_PREFIX + "__index__";
}

function readIndex(): CacheIndex {
  if (typeof localStorage === "undefined") return { keys: [] };
  try {
    const raw = localStorage.getItem(indexKey());
    if (!raw) return { keys: [] };
    const parsed = JSON.parse(raw) as CacheIndex;
    return Array.isArray(parsed.keys) ? parsed : { keys: [] };
  } catch {
    return { keys: [] };
  }
}

function writeIndex(idx: CacheIndex): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(indexKey(), JSON.stringify(idx));
  } catch {
    /* full or disabled */
  }
}

function entryKey(src: string): string {
  return CACHE_PREFIX + src;
}

function readEntry(src: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(entryKey(src));
  } catch {
    return null;
  }
}

function writeEntry(src: string, dataUrl: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(entryKey(src), dataUrl);
    const idx = readIndex();
    if (!idx.keys.includes(src)) {
      idx.keys.push(src);
      writeIndex(idx);
    }
    enforceBudget();
  } catch {
    /* full */
  }
}

function enforceBudget(): void {
  if (typeof localStorage === "undefined") return;
  let total = 0;
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(CACHE_PREFIX)) continue;
    const v = localStorage.getItem(k) ?? "";
    total += k.length + v.length;
  }
  if (total <= CACHE_BYTES_BUDGET) return;
  // Evict oldest.
  const idx = readIndex();
  for (const k of idx.keys) {
    try {
      localStorage.removeItem(entryKey(k));
    } catch {
      /* ignore */
    }
    const v = localStorage.getItem(k) ?? ""; // approximate
    total -= k.length + v.length;
    if (total <= CACHE_BYTES_BUDGET) break;
  }
  idx.keys = [];
  writeIndex(idx);
}

const inflight = new Map<string, Promise<string | null>>();

export function getCachedPoster(src: string): string | null {
  if (!src) return null;
  return readEntry(src);
}

export function clearPosterCache(): void {
  if (typeof localStorage === "undefined") return;
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
  }
}

/**
 * Extract the first usable frame from a same-origin video URL and cache
 * the JPEG data URL. Returns the cached URL when the source is the
 * same as a previous request, so concurrent callers share one decode.
 */
export function extractPoster(src: string): Promise<string | null> {
  if (!src) return Promise.resolve(null);
  const cached = readEntry(src);
  if (cached) return Promise.resolve(cached);
  const prev = inflight.get(src);
  if (prev) return prev;

  const task = (async () => {
    const url = await captureFrame(src);
    if (url) writeEntry(src, url);
    return url;
  })();
  inflight.set(src, task);
  task.finally(() => inflight.delete(src));
  return task;
}

async function captureFrame(src: string): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  // Only fetch the moov/header so the server can answer range requests
  // for the first frame instead of the whole file. Combined with a
  // faststart-encoded source, the total bytes for a poster capture
  // drops from the full video size to ~1 MB even for 100 MB+ files.
  video.preload = "metadata";
  video.crossOrigin = "anonymous";
  // Off-screen, no layout impact.
  video.style.position = "fixed";
  video.style.left = "-10000px";
  video.style.top = "0";
  video.style.width = "640px";
  video.style.height = "360px";
  video.style.pointerEvents = "none";
  document.body.appendChild(video);

  const cleanup = () => {
    try {
      video.pause();
    } catch {
      /* ignore */
    }
    video.removeAttribute("src");
    try {
      video.load();
    } catch {
      /* ignore */
    }
    if (video.parentNode) video.parentNode.removeChild(video);
  };

  return new Promise<string | null>((resolve) => {
    const fail = () => {
      cleanup();
      resolve(null);
    };
    const timer = window.setTimeout(fail, 8000);
    video.addEventListener("error", () => {
      window.clearTimeout(timer);
      fail();
    });
    video.addEventListener("loadedmetadata", () => {
      const seekTo = Math.min(0.5, (video.duration || 0) * 0.1);
      try {
        video.currentTime = seekTo;
      } catch {
        /* some browsers throw before play() */
      }
    });
    video.addEventListener("seeked", () => {
      window.clearTimeout(timer);
      try {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        const targetW = 480;
        const targetH = Math.max(1, Math.round((targetW * h) / Math.max(1, w)));
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          fail();
          return;
        }
        ctx.drawImage(video, 0, 0, targetW, targetH);
        const url = canvas.toDataURL("image/jpeg", FALLBACK_QUALITY);
        cleanup();
        resolve(url);
      } catch (err) {
        // Tainted canvas (CORS) is the most likely reason; fall back to
        // returning null so the caller falls back to the original poster.
        // eslint-disable-next-line no-console
        console.warn("[videoPoster] capture failed", err);
        fail();
      }
    });
    video.src = src;
  });
}
