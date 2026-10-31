// Hard-mode real-browser audit: walks every section, captures timing,
// network failures, console errors, long tasks, LCP, CLS, and JS heap.
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "output", "audit");
const USER_DATA = path.join(ROOT, "tmp", `audit-${Date.now()}`);
const CHROME = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DEBUG_PORT = 9555;
const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:5181/d/";

class Cdp {
  constructor(socket) {
    this.socket = socket; this.nextId = 1; this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const p = JSON.parse(event.data);
      if (!p.id) return;
      const h = this.pending.get(p.id); if (!h) return;
      this.pending.delete(p.id);
      if (p.error) h.reject(new Error(p.error.message)); else h.resolve(p.result);
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((r, e) => this.pending.set(id, { resolve: r, reject: e }));
  }
}
async function openCdp(url) {
  const socket = new WebSocket(url);
  await new Promise((r, e) => { socket.addEventListener("open", r, { once: true }); socket.addEventListener("error", e, { once: true }); });
  return new Cdp(socket);
}
async function waitForDebuggerUrl() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      if (res.ok) {
        const page = (await res.json()).find((e) => e.type === "page" && e.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(250);
  }
  throw new Error("Chrome debugger never came up");
}
async function evaluate(cdp, expression, awaitPromise = false) {
  const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? "eval failed");
  return r.result.value;
}

async function main() {
  await mkdir(OUTPUT, { recursive: true });
  await mkdir(USER_DATA, { recursive: true });

  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    `--user-data-dir=${USER_DATA}`,
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--window-size=1920,1080", "about:blank"
  ], { stdio: ["ignore", "pipe", "pipe"] });
  const stderr = [];
  chrome.stderr.on("data", (c) => stderr.push(c.toString()));

  const consoleEntries = [];
  const networkEntries = new Map();
  const longTasks = [];
  const layoutShifts = [];
  const eventCounts = new Map();

  try {
    const wsUrl = await waitForDebuggerUrl();
    const cdp = await openCdp(wsUrl);

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Performance.enable");
    // Set throttling closer to a real kiosk network
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false, latency: 40, downloadThroughput: 5 * 1024 * 1024, uploadThroughput: 1024 * 1024,
    });

    cdp.socket.addEventListener("message", (event) => {
      const m = JSON.parse(event.data);
      if (m.method === "Runtime.consoleAPICalled") {
        const text = (m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ");
        consoleEntries.push({ level: m.params.type, text });
      }
      if (m.method === "Runtime.exceptionThrown") {
        const ex = m.params.exceptionDetails;
        consoleEntries.push({ level: "exception", text: ex.text + " :: " + (ex.exception?.description ?? "") });
      }
      if (m.method === "Network.requestWillBeSent") {
        networkEntries.set(m.params.requestId, { url: m.params.request.url, method: m.params.request.method, startTime: m.params.timestamp });
      }
      if (m.method === "Network.responseReceived") {
        const r = m.params.response;
        const entry = networkEntries.get(m.params.requestId) ?? {};
        entry.status = r.status;
        entry.mime = r.mimeType;
        entry.fromCache = r.fromDiskCache || r.fromServiceWorker;
        entry.protocol = r.protocol;
        entry.encodedLength = Number(r.encodedDataLength ?? 0);
        entry.bodyLength = Number(r.connectionReused ? 0 : (r.dataLength ?? r.encodedDataLength ?? 0));
        networkEntries.set(m.params.requestId, entry);
      }
      if (m.method === "Network.loadingFinished") {
        const entry = networkEntries.get(m.params.requestId) ?? {};
        entry.encodedLength = Number(m.params.encodedDataLength ?? entry.encodedLength ?? 0);
        networkEntries.set(m.params.requestId, entry);
      }
      if (m.method === "Network.loadingFailed") {
        const entry = networkEntries.get(m.params.requestId) ?? {};
        entry.failed = m.params.errorText;
        networkEntries.set(m.params.requestId, entry);
      }
      if (m.method === "Performance.longtask") {
        longTasks.push({ duration: m.params.task.duration, startTime: m.params.task.startTime });
      }
      if (m.method === "Performance.layoutShift") {
        if (!m.params.hadRecentInput) layoutShifts.push(m.params.value);
      }
    });

    // Initial load
    await cdp.send("Page.navigate", { url: APP_URL });
    await sleep(4000);

    // Wait for hero to settle, then read LCP
    await sleep(2000);
    const initial = await evaluate(cdp, `(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      const lcp = performance.getEntriesByType('largest-contentful-paint');
      const r = performance.getEntriesByType('resource');
      return {
        domContentLoaded: nav?.domContentLoadedEventEnd ?? null,
        load: nav?.loadEventEnd ?? null,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime ?? null,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime ?? null,
        largestContentfulPaint: lcp.length ? lcp[lcp.length - 1].startTime : (window.__leqxPerf?.entries ?? []).filter(e => e.name === "lcp").slice(-1)[0]?.value ?? null,
        domNodes: document.querySelectorAll('*').length,
        activeSection: document.querySelector('.primary-navigation button.is-active')?.dataset?.section ?? null,
        heroCarousel: !!document.querySelector('.hero-carousel'),
        visibleImages: Array.from(document.images).filter(i => i.complete && i.naturalWidth > 0).length,
        brokenImages: Array.from(document.images).filter(i => i.complete && i.naturalWidth === 0).map(i => i.src),
        videos: document.querySelectorAll('video').length,
        videoSources: Array.from(document.querySelectorAll('video')).map(v => ({ ready: v.readyState, src: v.currentSrc })),
        heapUsed: performance.memory ? performance.memory.usedJSHeapSize : null,
        heapTotal: performance.memory ? performance.memory.totalJSHeapSize : null,
        transferEntries: r.length,
        transferBytes: r.reduce((s, e) => s + (e.encodedBodySize || e.transferSize || 0), 0),
      };
    })()`);

    // Walk every section, capture per-section metrics
    const sections = ["students", "courses", "staff", "honors", "about", "qidian", "yanxue"];
    const sectionReport = [];
    for (const s of sections) {
      const beforeReqs = networkEntries.size;
      await evaluate(cdp, `(() => {
        const nav = Array.from(document.querySelectorAll('.primary-navigation button'));
        const target = nav.find(b => b.dataset.section === ${JSON.stringify(s)});
        if (target) target.click();
        return Boolean(target);
      })()`);
      await sleep(4500);
      const probe = await evaluate(cdp, `(() => {
        const stage = document.querySelector('.category-stage');
        const cards = document.querySelectorAll('.orbit-rail-frame, .student-card');
        const broken = Array.from(document.images).filter(i => i.complete && i.naturalWidth === 0).map(i => i.src);
        const heroVid = document.querySelector('.category-backdrop video');
        return {
          sectionClass: stage?.className ?? null,
          cardCount: cards.length,
          broken,
          videoReady: heroVid ? heroVid.readyState : null,
          heapUsed: performance.memory ? performance.memory.usedJSHeapSize : null,
        };
      })()`);
      sectionReport.push({ section: s, newRequests: networkEntries.size - beforeReqs, ...probe });
    }

    // Final overall metrics
    const allEntries = Array.from(networkEntries.values());
    const failed = allEntries.filter(e => e.failed || (typeof e.status === "number" && e.status >= 400));
    const totalBytes = allEntries.reduce((s, e) => s + (e.encodedLength ?? 0), 0);
    const byType = {};
    for (const e of allEntries) {
      const key = (e.mime || "unknown").split(";")[0];
      byType[key] = byType[key] || { count: 0, bytes: 0 };
      byType[key].count += 1;
      byType[key].bytes += e.encodedLength ?? 0;
    }
    const byExt = {};
    for (const e of allEntries) {
      try {
        const ext = new URL(e.url).pathname.split(".").pop().toLowerCase();
        byExt[ext] = byExt[ext] || { count: 0, bytes: 0 };
        byExt[ext].count += 1;
        byExt[ext].bytes += e.encodedLength ?? 0;
      } catch {}
    }
    const top10 = allEntries
      .filter(e => e.encodedLength > 0)
      .sort((a, b) => b.encodedLength - a.encodedLength)
      .slice(0, 10)
      .map(e => ({ url: e.url.replace(APP_URL.replace(/\/$/, ""), "/d/"), size: e.encodedLength, mime: e.mime }));

    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(path.join(OUTPUT, "audit-home.png"), Buffer.from(screenshot.data, "base64"));

    const report = {
      url: APP_URL,
      initial,
      sections: sectionReport,
      totals: {
        totalRequests: allEntries.length,
        failedRequests: failed.length,
        totalBytes,
        byType,
        byExt,
      },
      longTasks,
      layoutShiftTotal: layoutShifts.reduce((s, v) => s + v, 0),
      consoleErrors: consoleEntries.filter(c => c.level === "error" || c.level === "exception"),
      consoleWarnings: consoleEntries.filter(c => c.level === "warning").slice(0, 10),
      failedSamples: failed.slice(0, 20),
      top10Resources: top10,
    };
    await writeFile(path.join(OUTPUT, "audit-report.json"), JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    chrome.kill();
    await sleep(500);
    await rm(USER_DATA, { recursive: true, force: true }).catch(() => {});
    if (stderr.length) await writeFile(path.join(OUTPUT, "audit-chrome.err.log"), stderr.join(""), "utf8");
  }
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exit(1); });
