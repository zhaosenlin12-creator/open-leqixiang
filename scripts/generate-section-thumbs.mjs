#!/usr/bin/env node
/**
 * Generate webp thumbnails and large copies for every image in the
 * given public/<section> directories. Mirrors the student flow but
 * generic: output paths are /<section>/thumb/<name>.webp and
 * /<section>/large/<name>.webp, so the client-side resolver can
 * translate a "/images/<section>/<name>.jpg" media path into a
 * /<section>/thumb/<name>.webp sibling.
 *
 *   node scripts/generate-section-thumbs.mjs
 *
 * Idempotent. Skips assets that already have a webp sibling of the
 * same base name.
 */
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, parse, sep } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SECTIONS = ["about", "staff", "courses", "pricing", "honors", "home", "showreel", "brand", "qidian", "yanxue"];
const VALID_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const THUMB_WIDTH = 480;
const LARGE_WIDTH = 1600;
const QUALITY = 78;

async function listImages(dir) {
  try {
    const names = await readdir(dir);
    return names.filter((f) => VALID_EXTS.has("." + f.toLowerCase().split(".").pop()));
  } catch {
    return [];
  }
}

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

async function generateOne(srcPath, dstThumb, dstLarge) {
  const tasks = [];
  if (!existsSync(dstThumb)) {
    tasks.push(
      sharp(srcPath)
        .rotate()
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(dstThumb)
    );
  }
  if (!existsSync(dstLarge)) {
    tasks.push(
      sharp(srcPath)
        .rotate()
        .resize({ width: LARGE_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(dstLarge)
    );
  }
  if (tasks.length) await Promise.all(tasks);
}

async function main() {
  const out = [];
  for (const section of SECTIONS) {
    const src = join(ROOT, "public", "images", section);
    const thumbDir = join(ROOT, "public", section, "thumb");
    const largeDir = join(ROOT, "public", section, "large");
    await ensureDir(thumbDir);
    await ensureDir(largeDir);
    const files = await listImages(src);
    let i = 0;
    for (const f of files) {
      const { name } = parse(f);
      const srcPath = join(src, f);
      const dstThumb = join(thumbDir, `${name}.webp`);
      const dstLarge = join(largeDir, `${name}.webp`);
      await generateOne(srcPath, dstThumb, dstLarge);
      out.push({ section, file: f, thumb: `/${section}/thumb/${name}.webp`, large: `/${section}/large/${name}.webp` });
      i++;
    }
    if (i) console.log(`[${section}] processed ${i} files`);
  }
  const manifest = join(ROOT, "public", "sections-thumbs-manifest.json");
  await writeFile(manifest, JSON.stringify({ generatedAt: new Date().toISOString(), count: out.length, entries: out }, null, 0), "utf8");
  console.log(`manifest: ${manifest} (${out.length} entries)`);
}

main().catch((err) => { console.error(err); process.exit(1); });

