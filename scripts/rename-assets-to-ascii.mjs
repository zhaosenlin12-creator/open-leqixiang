#!/usr/bin/env node
/**
 * One-shot ASCII rename pass: replace every non-ASCII filename in `public/`
 * with a stable English equivalent so that nginx (宝塔) can serve every asset
 * under codebn.cn/d/ without 404s. Display text in src/data/exhibition.ts
 * stays Chinese — only the URL/path strings change.
 *
 * Runs:
 *   - file rename in public/images/<section>/
 *   - file rename in public/<section>/{thumb,large}/  (cached webp variants)
 *   - sed-style rewrite of media/poster paths inside src/data/exhibition.ts
 *   - rewrite of public/sections-thumbs-manifest.json
 *
 * Idempotent: re-running is a no-op once everything is already English.
 * Safe to run from any cwd because it always resolves from script directory.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

// ── 1. Rename table ──────────────────────────────────────────────────────────
// Map the Chinese base name (without extension) to its English equivalent.
// All entries apply to:
const RENAMES = [
  // staff — section name "staff"
  { section: "staff", from: "刘老师  校长 创始人", to: "liu-principal" },
  { section: "staff", from: "森林老师  副校长 合伙人", to: "senlin-vp" },
  { section: "staff", from: "向老师 乐高专家", to: "xiang-lego" },
  { section: "staff", from: "杨老师  教学主管", to: "yang-director" },
  { section: "staff", from: "赵老师 教务财务", to: "zhao-admin" },
  { section: "staff", from: "周老师  硬件专家", to: "zhou-hardware" },

  // courses
  { section: "courses", from: "航模暑假1", to: "aeromod-summer-1" },
  { section: "courses", from: "乐高暑假班1", to: "lego-summer-1" },
  { section: "courses", from: "乐高暑假班2", to: "lego-summer-2" },
  { section: "courses", from: "python创赛营1", to: "python-camp-1" },
  { section: "courses", from: "python创赛营2", to: "python-camp-2" },
  { section: "courses", from: "python大圣班", to: "python-dasheng" },
  { section: "courses", from: "python暑假新生-1", to: "python-summer-fresh-1" },
  { section: "courses", from: "scratch暑假1", to: "scratch-summer-1" },
  { section: "courses", from: "图形化创赛营1", to: "scratch-camp-1" },
  { section: "courses", from: "图形化创赛营2", to: "scratch-camp-2" },
  { section: "courses", from: "特色课1", to: "special-1" },
  { section: "courses", from: "特色课2", to: "special-2" },
  { section: "courses", from: "特色课3", to: "special-3" },
  { section: "courses", from: "特色课4", to: "special-4" },
  { section: "courses", from: "特色课5", to: "special-5" },

  // pricing
  { section: "pricing", from: "编程1", to: "coding-1" },
  { section: "pricing", from: "编程2", to: "coding-2" },
  { section: "pricing", from: "编程总", to: "coding-all" },
  { section: "pricing", from: "乐高1", to: "lego-1" },
  { section: "pricing", from: "暑假编程", to: "summer-coding" },
  { section: "pricing", from: "暑假乐高", to: "summer-lego" },
  { section: "pricing", from: "特色课", to: "special" },
];

// qidian entries use compound names like "对讲机-video-<hash>" so we use
// prefix replacement at the file level (regex on the original filename).
const QIDIAN_PREFIX = [
  { from: /^对讲机-video-/, to: "intercom-video-" },
  { from: /^发电机-video-/, to: "generator-video-" },
  { from: /^水火箭炮-video-/, to: "water-rocket-video-" },
  { from: /^特色项目-video-3d打印/, to: "special-video-3d-print" },
  { from: /^特色项目-video-航模特色/, to: "special-video-aeromod" },
  { from: /^特色项目-video-社区科普/, to: "special-video-community" },
  { from: /^特色项目-video-图形化软件特色/, to: "special-video-scratch-sw" },
  { from: /^特色项目-video-硬件特色/, to: "special-video-hardware" },
  { from: /^AIcoding明星-video-/, to: "ai-coding-star-video-" },
];

// ── 2. Helpers ──────────────────────────────────────────────────────────────
function listSections() {
  return Array.from(new Set(RENAMES.map((r) => r.section)));
}

async function exists(p) {
  try {
    await import("node:fs").then((m) => m.promises.access(p));
    return true;
  } catch {
    return false;
  }
}

async function renameIfExists(src, dst) {
  if (!(await exists(src))) return false;
  if (await exists(dst)) {
    // target already exists: leave it alone (idempotent / safe re-run).
    return false;
  }
  await mkdir(dirname(dst), { recursive: true });
  await rename(src, dst);
  return true;
}

function applyQidianPrefix(name) {
  let out = name;
  for (const rule of QIDIAN_PREFIX) {
    if (rule.from.test(out)) {
      out = out.replace(rule.from, rule.to);
      break;
    }
  }
  return out;
}

// ── 3. File-system rename pass ──────────────────────────────────────────────
async function renameFiles() {
  const stats = { files: 0, sources: 0, caches: 0, skipped: 0 };

  // 3a. Sections covered by the explicit RENAMES table
  for (const rule of RENAMES) {
    const sourceDir = join(ROOT, "public", "images", rule.section);
    const thumbDir = join(ROOT, "public", rule.section, "thumb");
    const largeDir = join(ROOT, "public", rule.section, "large");

    const candidates = [".png", ".jpg", ".jpeg", ".webp", ".mp4"];
    for (const ext of candidates) {
      const oldSrc = join(sourceDir, rule.from + ext);
      const newSrc = join(sourceDir, rule.to + ext);
      const renamed = await renameIfExists(oldSrc, newSrc);
      if (renamed) {
        stats.sources += 1;
        stats.files += 1;
      } else if (await exists(oldSrc)) {
        stats.skipped += 1;
      }

      const oldThumb = join(thumbDir, rule.from + ".webp");
      const newThumb = join(thumbDir, rule.to + ".webp");
      const oldLarge = join(largeDir, rule.from + ".webp");
      const newLarge = join(largeDir, rule.to + ".webp");
      if (await renameIfExists(oldThumb, newThumb)) {
        stats.caches += 1;
        stats.files += 1;
      }
      if (await renameIfExists(oldLarge, newLarge)) {
        stats.caches += 1;
        stats.files += 1;
      }
    }
  }

  // 3b. Qidian — iterate all files under public/images/qidian and apply prefix rules
  const qidianDir = join(ROOT, "public", "images", "qidian");
  const qidianThumbDir = join(ROOT, "public", "qidian", "thumb");
  const qidianLargeDir = join(ROOT, "public", "qidian", "large");
  const { readdir } = await import("node:fs/promises");
  const names = (await readdir(qidianDir).catch(() => []));
  for (const name of names) {
    const newName = applyQidianPrefix(name);
    if (newName === name) continue;
    const oldSrc = join(qidianDir, name);
    const newSrc = join(qidianDir, newName);
    if (await renameIfExists(oldSrc, newSrc)) {
      stats.sources += 1;
      stats.files += 1;
    }

    // Cached webp uses the same base name as the source
    const { name: base } = parse(name);
    const { name: newBase } = parse(newName);
    if (base !== newBase) {
      const oldThumb = join(qidianThumbDir, base + ".webp");
      const newThumb = join(qidianThumbDir, newBase + ".webp");
      const oldLarge = join(qidianLargeDir, base + ".webp");
      const newLarge = join(qidianLargeDir, newBase + ".webp");
      if (await renameIfExists(oldThumb, newThumb)) {
        stats.caches += 1;
        stats.files += 1;
      }
      if (await renameIfExists(oldLarge, newLarge)) {
        stats.caches += 1;
        stats.files += 1;
      }
    }
  }

  return stats;
}

// ── 4. Code/manifest rewrite pass ───────────────────────────────────────────
function buildReplacePairs() {
  const pairs = [];
  for (const r of RENAMES) {
    const urlFrom = `/images/${r.section}/${r.from}`;
    const urlTo = `/images/${r.section}/${r.to}`;
    pairs.push([urlFrom, urlTo]);
  }
  // Qidian: build per-file pairs by scanning the (already renamed) source dir
  // and producing reverse maps from old → new.
  return pairs;
}

async function rewriteExhibition(pairs) {
  const file = join(ROOT, "src", "data", "exhibition.ts");
  const original = await readFile(file, "utf8");
  let updated = original;
  let hits = 0;
  for (const [from, to] of pairs) {
    const occurrences = updated.split(from).length - 1;
    if (occurrences > 0) {
      updated = updated.split(from).join(to);
      hits += occurrences;
    }
  }
  // Also handle qidian regex replacements inside the data file. We match the
  // literal Chinese prefix followed by "video-<hash>" or "video-<sub>-frame".
  const qidianPairs = [
    ["/images/qidian/对讲机-video-", "/images/qidian/intercom-video-"],
    ["/images/qidian/发电机-video-", "/images/qidian/generator-video-"],
    ["/images/qidian/水火箭炮-video-", "/images/qidian/water-rocket-video-"],
    ["/images/qidian/特色项目-video-3d打印", "/images/qidian/special-video-3d-print"],
    ["/images/qidian/特色项目-video-航模特色", "/images/qidian/special-video-aeromod"],
    ["/images/qidian/特色项目-video-社区科普", "/images/qidian/special-video-community"],
    ["/images/qidian/特色项目-video-图形化软件特色", "/images/qidian/special-video-scratch-sw"],
    ["/images/qidian/特色项目-video-硬件特色", "/images/qidian/special-video-hardware"],
    ["/images/qidian/AIcoding明星-video-", "/images/qidian/ai-coding-star-video-"],
  ];
  for (const [from, to] of qidianPairs) {
    const occurrences = updated.split(from).length - 1;
    if (occurrences > 0) {
      updated = updated.split(from).join(to);
      hits += occurrences;
    }
  }
  if (updated !== original) {
    await writeFile(file, updated, "utf8");
  }
  return { hits, changed: updated !== original };
}

async function rewriteSectionManifest() {
  const file = join(ROOT, "public", "sections-thumbs-manifest.json");
  const original = await readFile(file, "utf8");
  let updated = original;
  let hits = 0;
  for (const r of RENAMES) {
    const pairs = [
      [r.from + ".png", r.to + ".png"],
      [r.from + ".jpg", r.to + ".jpg"],
    ];
    for (const [from, to] of pairs) {
      const occurrences = updated.split(from).length - 1;
      if (occurrences > 0) {
        updated = updated.split(from).join(to);
        hits += occurrences;
      }
    }
  }
  // Qidian prefix replacements in manifest
  const qidianPairs = [
    ["对讲机-video-", "intercom-video-"],
    ["发电机-video-", "generator-video-"],
    ["水火箭炮-video-", "water-rocket-video-"],
    ["特色项目-video-3d打印", "special-video-3d-print"],
    ["特色项目-video-航模特色", "special-video-aeromod"],
    ["特色项目-video-社区科普", "special-video-community"],
    ["特色项目-video-图形化软件特色", "special-video-scratch-sw"],
    ["特色项目-video-硬件特色", "special-video-hardware"],
    ["AIcoding明星-video-", "ai-coding-star-video-"],
  ];
  for (const [from, to] of qidianPairs) {
    const occurrences = updated.split(from).length - 1;
    if (occurrences > 0) {
      updated = updated.split(from).join(to);
      hits += occurrences;
    }
  }
  if (updated !== original) {
    await writeFile(file, updated, "utf8");
  }
  return { hits, changed: updated !== original };
}

// ── 5. Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("→ renaming asset files in public/");
  const fileStats = await renameFiles();
  console.log(`   renamed ${fileStats.files} files (sources: ${fileStats.sources}, cached webp: ${fileStats.caches}, skipped: ${fileStats.skipped})`);

  const pairs = buildReplacePairs();
  console.log("→ rewriting src/data/exhibition.ts paths");
  const exh = await rewriteExhibition(pairs);
  console.log(`   ${exh.changed ? "updated" : "no change"} — ${exh.hits} path string(s) replaced`);

  console.log("→ rewriting public/sections-thumbs-manifest.json");
  const m = await rewriteSectionManifest();
  console.log(`   ${m.changed ? "updated" : "no change"} — ${m.hits} filename(s) replaced`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
