#!/usr/bin/env node
/**
 * Post-build step: rewrite absolute asset paths in dist to relative ones
 * so the bundle can be dropped into any subdirectory (e.g.
 * `https://codebn.cn/d/`) and still resolve media correctly.
 *
 * Handles three quoting styles used in the bundled JS:
 *   - double quote:      "/images/foo.png"
 *   - single quote:      '/images/foo.png'
 *   - template literal:  `/images/${file}`   (kept as a single token)
 *
 *   node scripts/postbuild-relativize-paths.mjs
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");

const PREFIXES = [
  "/images/",
  "/home/",
  "/showreel/",
  "/students/",
  "/about/",
  "/staff/",
  "/courses/",
  "/honors/",
  "/pricing/",
  "/brand/",
  "/content/",
  "/qidian/",
  "/yanxue/",
  "/sections-thumbs-manifest.json",
  "/students-manifest.json",
  "/students-thumbs-manifest.json",
];

const TARGET_EXTS = new Set([".html", ".js", ".css", ".mjs", ".json"]);

function escapeRegExp(s) {
  return s.replace(/[\/\\^$+*?()[\]{}|]/g, "\\$&");
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else yield full;
  }
}

// Match any of the three string-literal openers before the prefix.
// For a template literal like `` `/images/foo/${bar}` `` we just strip the
// leading slash so it becomes `` `./images/foo/${bar}` ``.
const OPENERS = ["\"", "'", "`"];

let touched = 0;
for (const file of walk(DIST)) {
  if (!TARGET_EXTS.has(extname(file))) continue;
  const original = readFileSync(file, "utf8");
  let updated = original;
  for (const prefix of PREFIXES) {
    const relPrefix = "./" + prefix.slice(1);
    for (const opener of OPENERS) {
      const re = new RegExp(escapeRegExp(opener + prefix), "g");
      updated = updated.replace(re, opener + relPrefix);
    }
  }
  if (updated !== original) {
    writeFileSync(file, updated, "utf8");
    touched += 1;
    console.log("rewrote", relative(DIST, file));
  }
}

console.log("[relativize] touched " + touched + " file(s)");