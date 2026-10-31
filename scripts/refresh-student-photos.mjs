#!/usr/bin/env node
/**
 * Refresh the student archive supplement list from disk and re-emit
 * a clean copy block. Run this whenever the user adds more photos
 * to public/images/students/ — no other file changes are needed.
 *
 *   node scripts/refresh-student-photos.mjs
 *
 * It will:
 *   1. Scan public/images/students for .jpg / .jpeg / .png
 *   2. Keep the 7 curated entries already defined in sections.students.items
 *   3. Re-emit the supplement array (alphabetical, leading "image*.png" first)
 *   4. Overwrite the supplement body and copy block in src/data/exhibition.ts
 *   5. Regenerate public/students-manifest.json so the runtime can lazy-load
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const TS_PATH = join(ROOT, "src/data/exhibition.ts");
const PHOTO_DIR = join(ROOT, "public/images/students");
const MANIFEST_PATH = join(ROOT, "public/students-manifest.json");

const CURATED_IDS = [
  "curiosity",
  "idea",
  "team",
  "challenge",
  "explore",
  "present",
  "practice"
];

const VALID_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function basename(p) {
  return p.split(/[\\/]/).pop();
}

function listPhotos() {
  return readdirSync(PHOTO_DIR)
    .filter((f) => VALID_EXTS.has("." + f.toLowerCase().split(".").pop()))
    .map(basename);
}

function curatedFilenames(text) {
  const out = new Set();
  for (const id of CURATED_IDS) {
    const re = new RegExp('"id":\\s*"' + id + '"[\\s\\S]*?"media":\\s*"([^"]+)"');
    const m = re.exec(text);
    if (m) out.add(basename(m[1]));
  }
  return out;
}

function buildSupplement(supplementFiles) {
  return supplementFiles
    .map((f) => "  '" + f + "',")
    .join("\r\n");
}

function buildCopyBlock() {
  return [
    "].map((file, index) => {",
    "  const isPng = file.toLowerCase().endsWith('.png');",
    "  const accent: 'blue' | 'yellow' | 'orange' = index % 3 === 0 ? 'blue' : index % 3 === 1 ? 'yellow' : 'orange';",
    "  const number = String(index + 1).padStart(2, '0');",
    "  return {",
    "    id: `students-archive-${number}`,",
    "    eyebrow: `成长档案 ${number}`,",
    "    title: `学员成长记录 ${number}`,",
    "    description: '把每一次认真记录下来，用作品和荣誉连成成长轨迹。',",
    "    media: `/images/students/${file}`,",
    "    fit: 'contain',",
    "    accent,",
    "    tags: ['学员', '成长', isPng ? '作品' : '档案'],",
    "    details: [",
    "      '在课堂里认真观察、动手尝试',",
    "      '把过程和作品都留下来',",
    "      '在分享中变得更自信',",
    "    ]",
    "  };",
    "});"
  ].join("\r\n");
}

function buildManifest(files) {
  return {
    generatedAt: new Date().toISOString(),
    count: files.length,
    files
  };
}

const ts = readFileSync(TS_PATH, "utf8");
const photos = listPhotos();
const curated = curatedFilenames(ts);
const supplement = photos
  .filter((f) => !curated.has(f))
  .sort((a, b) => a.localeCompare(b, "en"));

const supStart = ts.indexOf("studentArchiveSupplement: ExhibitionItem[] = [");
const supEnd = ts.indexOf("].map", supStart);
if (supStart === -1 || supEnd === -1) {
  console.error("Could not locate supplement block in exhibition.ts");
  process.exit(1);
}

const supHeader = "studentArchiveSupplement: ExhibitionItem[] = [";
const supFooter = "].map((file, index) => {";

const newSupBlock =
  supHeader + "\r\n" + buildSupplement(supplement);

const copyStart = supEnd;
const copyEndMarker = "});";
const copyEnd = ts.indexOf(copyEndMarker, copyStart);
if (copyStart === -1 || copyEnd === -1) {
  console.error("Could not locate copy block in exhibition.ts");
  process.exit(1);
}

const newTs =
  ts.substring(0, supStart) +
  newSupBlock +
  "\r\n" +
  buildCopyBlock() +
  ts.substring(copyEnd + copyEndMarker.length);

writeFileSync(TS_PATH, newTs, "utf8");
writeFileSync(MANIFEST_PATH, JSON.stringify(buildManifest(photos)), "utf8");
console.log(
  "refreshed: " + supplement.length + " supplement + " + curated.size + " curated = " +
    (supplement.length + curated.size) + " total (disk has " + photos.length + ")"
);
console.log("manifest: " + MANIFEST_PATH + " (" + photos.length + " files)");
