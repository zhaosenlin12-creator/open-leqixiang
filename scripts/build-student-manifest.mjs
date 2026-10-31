#!/usr/bin/env node
/**
 * Build public/students-manifest.json from public/images/students.
 *
 * The list is the single source of truth for "what photos exist on disk".
 * It lets the SPA load only the metadata at startup (a few KB) and keep
 * the 150+ image references out of the JS bundle that Vite ships.
 *
 *   node scripts/build-student-manifest.mjs
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PHOTO_DIR = join(ROOT, "public/images/students");
const OUT = join(ROOT, "public/students-manifest.json");

const VALID_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function listPhotos() {
  return readdirSync(PHOTO_DIR)
    .filter((f) => VALID_EXTS.has("." + f.toLowerCase().split(".").pop()))
    .sort((a, b) => a.localeCompare(b, "en"));
}

const files = listPhotos();
const manifest = {
  generatedAt: new Date().toISOString(),
  count: files.length,
  files
};

writeFileSync(OUT, JSON.stringify(manifest), "utf8");
console.log("wrote " + OUT + " (" + files.length + " files, " + Buffer.byteLength(JSON.stringify(manifest), "utf8") + " bytes)");
