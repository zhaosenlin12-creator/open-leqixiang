#!/usr/bin/env node
/**
 * Generate webp thumbnails (360w) and webp "large" copies (1280w) of
 * every photo in public/images/students. The originals are kept on disk
 * so paths in src/data/exhibition.ts remain valid; the generated webp
 * files are referenced by StudentGallery via <picture> so the browser
 * can pick the smaller format when supported.
 *
 *   node scripts/generate-student-thumbs.mjs
 *
 * Idempotent: re-running is a no-op for files that already exist. The
 * script also writes a public/students-thumbs-manifest.json so the
 * client side can verify which thumbnails are available.
 */
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, parse } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SRC = join(ROOT, "public/images/students");
const THUMB_DIR = join(ROOT, "public/students/thumb");
const LARGE_DIR = join(ROOT, "public/students/large");
const MANIFEST = join(ROOT, "public/students-thumbs-manifest.json");

const VALID_EXTS = new Set([".jpg", ".jpeg", ".png"]);
const THUMB_WIDTH = 360;
const LARGE_WIDTH = 1280;
const QUALITY = 78;

async function listPhotos() {
  const names = await readdir(SRC);
  return names.filter((f) => VALID_EXTS.has("." + f.toLowerCase().split(".").pop()));
}

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

async function generateOne(file) {
  const { name } = parse(file);
  const srcPath = join(SRC, file);
  const thumbPath = join(THUMB_DIR, `${name}.webp`);
  const largePath = join(LARGE_DIR, `${name}.webp`);

  const tasks = [];
  if (!existsSync(thumbPath)) {
    tasks.push(
      sharp(srcPath)
        .rotate()
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(thumbPath)
    );
  }
  if (!existsSync(largePath)) {
    tasks.push(
      sharp(srcPath)
        .rotate()
        .resize({ width: LARGE_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(largePath)
    );
  }
  await Promise.all(tasks);
  return { file, thumb: `/students/thumb/${name}.webp`, large: `/students/large/${name}.webp` };
}

async function main() {
  await ensureDir(THUMB_DIR);
  await ensureDir(LARGE_DIR);
  const files = await listPhotos();
  const concurrency = 8;
  const out = [];
  let done = 0;
  for (let i = 0; i < files.length; i += concurrency) {
    const slice = files.slice(i, i + concurrency);
    const results = await Promise.all(slice.map(generateOne));
    out.push(...results);
    done += slice.length;
    if (done % 16 === 0 || done === files.length) {
      console.log(`processed ${done}/${files.length}`);
    }
  }
  const totalThumbBytes = await sumBytes(out.map((e) => join(THUMB_DIR, parse(e.thumb).base)));
  const totalLargeBytes = await sumBytes(out.map((e) => join(LARGE_DIR, parse(e.large).base)));
  console.log(`thumb total: ${(totalThumbBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`large total: ${(totalLargeBytes / 1024 / 1024).toFixed(1)} MB`);
  await writeFile(
    MANIFEST,
    JSON.stringify({ generatedAt: new Date().toISOString(), count: out.length, entries: out }, null, 0),
    "utf8"
  );
  console.log(`manifest: ${MANIFEST}`);
}

async function sumBytes(paths) {
  let total = 0;
  for (const p of paths) {
    try {
      const s = await stat(p);
      total += s.size;
    } catch {
      /* missing — counted as 0 */
    }
  }
  return total;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
