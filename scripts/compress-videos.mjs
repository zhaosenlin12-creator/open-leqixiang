#!/usr/bin/env node
/**
 * Compress the videos in public/images/{home,showreel} to a kiosk-friendly
 * size. Re-encodes with h264 (broadest support) at a target average
 * bitrate that'\''s plenty for 720p display, and writes a small
 * MP4Box-style sibling with the same name + .compressed.mp4.
 *
 *   node scripts/compress-videos.mjs
 *
 * Requires ffmpeg on PATH. The script refuses to run if ffmpeg is
 * missing and prints the manual recipe; intentional so we never end
 * up with a half-processed directory.
 */
import { readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import { join, parse } from "node:path";

const ROOT = process.cwd();
const TARGETS = [
  { dir: "public/images/home",     width: 1280, bitrate: "1800k", audio: "96k" },
  { dir: "public/images/showreel", width: 960,  bitrate: "1200k", audio: "96k" }
];

function checkFfmpeg() {
  try {
    const out = execSync("ffmpeg -version", { stdio: ["ignore", "pipe", "ignore"] }).toString();
    return out.split("\n", 1)[0] || "ffmpeg found";
  } catch {
    return null;
  }
}

async function listVideos(dir) {
  try {
    const names = await readdir(dir);
    return names.filter((f) => f.toLowerCase().endsWith(".mp4"));
  } catch {
    return [];
  }
}

function runFfmpeg(input, output, opts) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i", input,
      "-vf", `scale='min(${opts.width},iw)':-2`,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-b:v", opts.bitrate,
      "-maxrate", opts.bitrate,
      "-bufsize", "2M",
      "-c:a", "aac",
      "-b:a", opts.audio,
      "-movflags", "+faststart",
      output
    ];
    const proc = spawn("ffmpeg", args, { stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code} for ${input}`));
    });
    proc.on("error", reject);
  });
}

async function main() {
  const version = checkFfmpeg();
  if (!version) {
    console.log("ffmpeg not found on PATH. Manual recipe:\n");
    console.log("  1. Download ffmpeg (https://www.gyan.dev/ffmpeg/builds/)");
    console.log("  2. Add to PATH");
    console.log("  3. Re-run this script\n");
    console.log("Or, for each big video, run:");
    for (const t of TARGETS) {
      for (const f of await listVideos(join(ROOT, t.dir))) {
        const inP = join(t.dir, f);
        const outP = join(t.dir, parse(f).name + ".compressed.mp4");
        console.log(`  ffmpeg -y -i "${inP}" -vf "scale='min(${t.width},iw)':-2" -c:v libx264 -preset veryfast -crf 23 -b:v ${t.bitrate} -maxrate ${t.bitrate} -bufsize 2M -c:a aac -b:a ${t.audio} -movflags +faststart "${outP}"`);
      }
    }
    process.exit(0);
  }
  console.log(version);
  const report = [];
  for (const t of TARGETS) {
    const dir = join(ROOT, t.dir);
    for (const f of await listVideos(dir)) {
      const input = join(dir, f);
      const outName = parse(f).name + ".compressed.mp4";
      const output = join(dir, outName);
      if (existsSync(output)) {
        const s = await stat(output);
        console.log(`[skip] ${outName} already exists (${(s.size/1024*1024).toFixed(1)} MB)`);
        continue;
      }
      const before = (await stat(input)).size;
      console.log(`[run ] ${t.dir}/${f}  (${(before/1024*1024).toFixed(1)} MB) -> ${outName}`);
      await runFfmpeg(input, output, t);
      const after = (await stat(output)).size;
      const saved = before - after;
      report.push({ input, output, before, after, saved });
      console.log(`       -> ${(after/1024*1024).toFixed(1)} MB  (saved ${(saved/1024*1024).toFixed(1)} MB)`);
    }
  }
  await writeFile(join(ROOT, "public/videos-compression-report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(`\nreport: public/videos-compression-report.json (${report.length} videos)`);
  console.log("When happy with the output, rename .compressed.mp4 to replace the original and rerun refresh + tests.");
}

main().catch((err) => { console.error(err); process.exit(1); });
