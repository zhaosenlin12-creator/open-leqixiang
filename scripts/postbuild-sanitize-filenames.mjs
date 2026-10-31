#!/usr/bin/env node
/**
 * Post-build step: rewrite non-ASCII filenames in dist/ to ASCII hashes,
 * and rewrite every reference to those files in the same dist/ tree.
 *
 * Why: nginx on the production box returns 404 for any path that
 * contains a non-ASCII byte (e.g. /d/images/courses/乐高暑假班1.png
 * returns the SPA's 404 page even though the file is on disk). This
 * avoids the whole class of UTF-8-vs-nginx problems by giving every
 * file a guaranteed-ASCII name. Display text in the React tree
 * (item.title, item.description, item.tags, etc.) is untouched.
 *
 *   node scripts/postbuild-sanitize-filenames.mjs
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, statSync, renameSync } from "node:fs";
import { extname, join, relative, basename } from "node:path";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");

const NON_ASCII = /[^\x00-\x7F]/;
const TARGET_EXTS = new Set([".html", ".js", ".css", ".mjs", ".json"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else yield full;
  }
}

// Deterministic ASCII name: cn-<sha256[:8]><ext>
function asciiName(originalName) {
  const ext = extname(originalName);
  const h = createHash("sha256").update(originalName).digest("hex").slice(0, 8);
  return `cn-${h}${ext}`;
}

// Pass 1: rename every file with a non-ASCII name. Track old name ->
// new name (basename only) so we can also rewrite the basename inside
// manifest fields like { section, file, thumb, large }.
const renames = new Map(); // oldRel -> newRel
const baseRenames = new Map(); // oldBase -> newBase (basename only)
let renamedCount = 0;
for (const file of walk(DIST)) {
  const base = basename(file);
  if (!NON_ASCII.test(base)) continue;
  const dir = file.slice(0, file.length - base.length);
  const newBase = asciiName(base);
  const newPath = join(dir, newBase);
  renameSync(file, newPath);
  const oldRel = relative(DIST, file).replace(/\\/g, "/");
  const newRel = relative(DIST, newPath).replace(/\\/g, "/");
  renames.set(oldRel, newRel);
  baseRenames.set(base, newBase);
  renamedCount += 1;
  console.log(`renamed: ${oldRel} -> ${newRel}`);
}

if (renames.size === 0) {
  console.log("[sanitize] nothing to do, every filename is already ASCII");
  process.exit(0);
}

// Pass 2: rewrite every reference inside text/JSON files. Sort by
// descending length so longer oldRel wins.
const pairs = Array.from(renames.entries()).sort((a, b) => b[0].length - a[0].length);
const basePairs = Array.from(baseRenames.entries()).sort((a, b) => b[0].length - a[0].length);
let touched = 0;
for (const file of walk(DIST)) {
  if (!TARGET_EXTS.has(extname(file))) continue;
  let content = readFileSync(file, "utf8");
  let updated = content;
  for (const [oldR, newR] of pairs) {
    if (updated.includes(oldR)) {
      updated = updated.split(oldR).join(newR);
    }
  }
  // Also rewrite basenames that appear standalone (e.g. manifest
  // `file: "森林老师.png"`). We only rewrite a basename if it is
  // wrapped in JSON-string delimiters, to avoid matching substrings
  // inside titles / descriptions that the user wanted to keep intact.
  for (const [oldB, newB] of basePairs) {
    const quoted = `"${oldB}"`;
    const replaced = `"${newB}"`;
    if (updated.includes(quoted)) {
      updated = updated.split(quoted).join(replaced);
    }
  }
  if (updated !== content) {
    writeFileSync(file, updated, "utf8");
    touched += 1;
    console.log(`rewrote: ${relative(DIST, file)}`);
  }
}

console.log(`[sanitize] renamed ${renamedCount} file(s), rewrote refs in ${touched} file(s)`);
