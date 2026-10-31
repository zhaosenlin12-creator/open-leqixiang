#!/usr/bin/env node
/**
 * Spin up `vite preview` against ./dist and probe the response headers
 * + sizes for representative assets. Prints a one-screen report.
 *
 *   node scripts/verify-headers.mjs
 *
 * Vite'\''s preview server is intentionally simple: it doesn'\''t compress
 * or set long-lived cache headers. The point of this script is to:
 *   - prove dist/ is shippable (200 OK on every probed path)
 *   - surface a checklist of what production nginx / Caddy MUST add
 *   - warn when the preview returns text responses without
 *     content-encoding (so you know to enable gzip / brotli in prod)
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");
const PORT = 4175;
const URL_BASE = `http://127.0.0.1:${PORT}`;

if (!existsSync(DIST)) {
  console.error("dist/ missing — run `npm run build` first");
  process.exit(1);
}

const PROBES = [
  "/",
  "/index.html",
  "/assets/index-DORD3agD.css",
  "/students-manifest.json",
  "/students-thumbs-manifest.json",
  "/sections-thumbs-manifest.json",
  "/images/students/4a38a655a28cacc5f63c32739a18d191.jpg",
  "/students/thumb/4a38a655a28cacc5f63c32739a18d191.webp"
];

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(URL_BASE + "/");
      if (r.ok) return;
    } catch {
      /* not ready */
    }
    await sleep(500);
  }
  throw new Error("server never came up");
}

async function main() {
  const proc = spawn(process.execPath, [join(ROOT, "node_modules/vite/bin/vite.js"), "preview", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });
  proc.stderr.on("data", () => {});
  proc.stdout.on("data", () => {});
  try {
    await waitForServer();
    console.log(`vite preview up @ ${URL_BASE}\n`);
    for (const path of PROBES) {
      const url = URL_BASE + path;
      try {
        const r = await fetch(url);
        const len = r.headers.get("content-length");
        const enc = r.headers.get("content-encoding");
        const type = r.headers.get("content-type");
        const cache = r.headers.get("cache-control");
        const mark = r.ok ? "OK" : r.status;
        const notes = [];
        if (path.startsWith("/assets/") && (!cache || !/immutable/.test(cache))) {
          notes.push("WARN: /assets/* missing immutable cache-control");
        }
        if (path === "/index.html" && cache && !/no-cache/.test(cache)) {
          notes.push("WARN: index.html should be no-cache for fresh deploys");
        }
        if (!enc && type && /text|javascript|json|svg/.test(type)) {
          notes.push("INFO: text asset served uncompressed by vite preview (enable gzip/brotli in prod)");
        }
        console.log(`${String(mark).padEnd(3)} ${path.padEnd(70)}  len=${len ?? "?"}  enc=${enc ?? "-"}  cc=${cache ?? "-"}`);
        for (const n of notes) console.log(`     -> ${n}`);
      } catch (err) {
        console.log(`ERR  ${path}  (${err.message})`);
      }
    }
    console.log("\nSee dist/_cache-headers.nginx.conf for production-grade cache + compression settings.");
  } finally {
    proc.kill();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
