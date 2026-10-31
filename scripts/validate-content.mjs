import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'public');
const contentRoot = path.join(publicRoot, 'content');

const required = [
  'site.json',
  'modules.json',
  'courses.json',
  'tours.json',
  'playlists.json',
  'pricing.json',
  'achievements.json',
  'students.json',
  'staff.json',
  'assets.json'
];

async function readJson(file) {
  return JSON.parse(await readFile(path.join(contentRoot, file), 'utf8'));
}

async function existsPublicPath(publicPath) {
  const clean = publicPath.replace(/^\//, '');
  await access(path.join(publicRoot, clean));
}

async function main() {
  for (const file of required) {
    await access(path.join(contentRoot, file));
  }

  const assets = await readJson('assets.json');
  const playlists = await readJson('playlists.json');
  const tours = await readJson('tours.json');
  const modules = await readJson('modules.json');
  const courses = await readJson('courses.json');

  const assetIds = new Set(assets.map((asset) => asset.id));
  const moduleIds = new Set(modules.map((module) => module.id));
  const courseIds = new Set(courses.stages.map((course) => course.id));

  for (const asset of assets) {
    if (asset.path) await existsPublicPath(asset.path);
  }

  for (const item of playlists) {
    if (item.assetId && !assetIds.has(item.assetId)) {
      throw new Error(`Playlist item "${item.id}" references missing asset "${item.assetId}"`);
    }
    if (item.type === 'module' && item.refId && !moduleIds.has(item.refId)) {
      throw new Error(`Playlist item "${item.id}" references missing module "${item.refId}"`);
    }
    if (item.type === 'course' && item.refId && !courseIds.has(item.refId)) {
      throw new Error(`Playlist item "${item.id}" references missing course "${item.refId}"`);
    }
  }

  for (const tour of tours) {
    if (!tour.nodes.length) throw new Error(`Tour "${tour.id}" has no nodes`);
  }

  console.log(`Validated ${assets.length} assets, ${playlists.length} playlist items, ${tours.length} tours.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

