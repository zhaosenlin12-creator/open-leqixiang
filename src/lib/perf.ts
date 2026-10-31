/**
 * Lightweight web-vitals observer. Reports LCP, CLS, INP and any long
 * tasks > 50ms to a small in-memory ring buffer that surfaces on
 * `window.__leqxPerf`. Nothing is sent over the network — kiosk displays
 * stay offline. The point is to make performance regressions visible
 * in the browser console / DevTools without pulling in a 12 KB lib.
 */
export interface PerfEntry {
  name: "lcp" | "cls" | "inp" | "longtask";
  value: number;
  at: number;
  detail?: string;
}

const RING_SIZE = 50;
const ring: PerfEntry[] = [];

declare global {
  interface Window {
    __leqxPerf?: { entries: PerfEntry[]; flush: () => PerfEntry[] };
  }
}

function push(entry: PerfEntry): void {
  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();
  if (typeof window !== "undefined") {
    window.__leqxPerf = window.__leqxPerf ?? {
      entries: ring,
      flush: () => {
        const snapshot = ring.slice();
        ring.length = 0;
        return snapshot;
      }
    };
  }
  // Quiet dev signal — set to false to silence.
  if (typeof console !== "undefined" && (console as { __leqxPerfQuiet?: boolean }).__leqxPerfQuiet !== true) {
    // eslint-disable-next-line no-console
    console.debug("[perf]", entry.name, entry.value.toFixed(1), entry.detail ?? "");
  }
}

function start(): void {
  if (typeof window === "undefined") return;
  if ((window as { __leqxPerfStarted?: boolean }).__leqxPerfStarted) return;
  (window as { __leqxPerfStarted?: boolean }).__leqxPerfStarted = true;

  // LCP
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) push({ name: "lcp", value: last.startTime, at: Date.now() });
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    /* unsupported */
  }

  // CLS
  try {
    let cls = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntry[]) {
        const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!e.hadRecentInput) cls += e.value ?? 0;
      }
      push({ name: "cls", value: cls, at: Date.now() });
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
  } catch {
    /* unsupported */
  }

  // INP (replacement for deprecated FID; available in newer browsers)
  try {
    const inpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntry[]) {
        const e = entry as PerformanceEntry & { duration?: number };
        push({ name: "inp", value: e.duration ?? 0, at: Date.now() });
      }
    });
    inpObserver.observe({ type: "interaction", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  } catch {
    /* unsupported */
  }

  // Long tasks > 50ms
  try {
    const ltObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntry[]) {
        const e = entry as PerformanceEntry & { duration?: number };
        if ((e.duration ?? 0) > 50) {
          push({ name: "longtask", value: e.duration ?? 0, at: Date.now() });
        }
      }
    });
    ltObserver.observe({ type: "longtask", buffered: true });
  } catch {
    /* unsupported */
  }
}

/**
 * Start the web-vitals observers as early as possible.
 *
 * `sync: true` registers the observers synchronously so they catch the very
 * first LCP/CLS/longtask events that fire before React commits. Without
 * this the buffered PerformanceObserver only sees events from the moment
 * it was registered, which usually means LCP comes back as `null` in
 * instrumentation. The init body itself is small (~1 ms) and never blocks
 * paint, so there is no reason to defer it.
 */
export function startPerfObserver(sync = false): void {
  if (typeof window === "undefined") return;
  if (sync) {
    start();
    return;
  }
  // Legacy path: defer to idle. Kept for callers that explicitly want the
  // soft-delay behavior. Prefer passing `true` from main.tsx.
  if ("requestIdleCallback" in window) {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (typeof ric === "function") ric(start);
  } else {
    globalThis.setTimeout(start, 0);
  }
}
