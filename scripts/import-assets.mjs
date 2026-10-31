import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const websiteRoot = path.join(root, '.context', 'my-website');
const publicRoot = path.join(root, 'public');
const assetsRoot = path.join(publicRoot, 'images');

const require = createRequire(import.meta.url);

const websiteAssets = [
  ['images/logo.svg', 'brand/logo.svg', 'logo', '乐启享 Logo', 'brand'],
  ['images/logo11.png', 'brand/logo.png', 'logo-png', '乐启享 Logo PNG', 'brand'],
  ['images/hero-bg.webp', 'website/hero-bg.webp', 'hero-bg', '官网首页背景', 'brand'],
  ['images/classroom7.webp', 'website/classroom7.webp', 'classroom-7', '真实课堂', 'classroom'],
  ['images/classroom6.webp', 'website/classroom6.webp', 'classroom-6', '课堂环境', 'classroom'],
  ['images/classroom3.webp', 'website/classroom3.webp', 'classroom-3', '课堂互动', 'classroom'],
  ['images/classroom8.webp', 'website/classroom8.webp', 'classroom-8', '课堂作品', 'classroom'],
  ['images/lego-course.webp', 'website/lego-course.webp', 'lego-course', '乐高课程', 'course'],
  ['images/python-course.webp', 'website/python-course.webp', 'python-course', 'Python课程', 'course'],
  ['images/cpp-course.webp', 'website/cpp-course.webp', 'cpp-course', 'C++课程', 'course'],
  ['images/robot-camp.webp', 'website/robot-camp.webp', 'robot-camp', '机器人营地', 'course'],
  ['images/cert1.webp', 'website/cert1.webp', 'cert-1', '证书荣誉', 'achievement'],
  ['images/cert4.webp', 'website/cert4.webp', 'cert-4', '荣誉展示', 'achievement'],
  ['images/cert5.webp', 'website/cert5.webp', 'cert-5', '成果证书', 'achievement'],
  ['images/camp2.webp', 'website/camp2.webp', 'camp-2', '营地活动', 'activity'],
  ['images/camp3.webp', 'website/camp3.webp', 'camp-3', '活动现场', 'activity'],
  ['images/camp4.webp', 'website/camp4.webp', 'camp-4', '科技活动', 'activity'],
  ['images/challenge2.webp', 'website/challenge2.webp', 'challenge-2', '挑战赛', 'competition'],
  ['images/challenge3.webp', 'website/challenge3.webp', 'challenge-3', '竞赛训练', 'competition'],
  ['images/challenge4.webp', 'website/challenge4.webp', 'challenge-4', '赛事活动', 'competition'],
  ['video/camp1.mp4', 'videos/camp1.mp4', 'camp-video-1', '营地视频1', 'activity'],
  ['video/camp2.mp4', 'videos/camp2.mp4', 'camp-video-2', '营地视频2', 'activity'],
  ['video/camp3.mp4', 'videos/camp3.mp4', 'camp-video-3', '营地视频3', 'activity']
];

async function copyAsset([sourceRelative, targetRelative]) {
  const source = path.join(websiteRoot, sourceRelative);
  const target = path.join(assetsRoot, targetRelative);
  if (!existsSync(source)) {
    console.warn(`Missing source asset: ${sourceRelative}`);
    return false;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
  return true;
}

function simplifyCourses(courseData) {
  return {
    stages: courseData.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      ageRange: stage.ageRange,
      tagline: stage.tagline,
      description: stage.description,
      highlights: stage.highlights ?? [],
      color: stage.color,
      stageOutput: stage.subCourses?.at(-1)?.stageOutput ?? stage.subCourses?.[0]?.summary ?? ''
    })),
    routes: Object.entries(courseData.routes).map(([id, route]) => ({
      id,
      name: route.name,
      description: route.description,
      path: route.path
    }))
  };
}

async function main() {
  await mkdir(assetsRoot, { recursive: true });
  const copied = [];
  for (const asset of websiteAssets) {
    if (await copyAsset(asset)) {
      const [, targetRelative, id, title, tag] = asset;
      copied.push({
        id,
        title,
        type: targetRelative.endsWith('.mp4') ? 'video' : 'image',
        source: 'website',
        path: `/images/${targetRelative.replaceAll(path.sep, '/')}`,
        displayable: true,
        privacy: 'public',
        tags: [tag]
      });
    }
  }

  const courseData = require(path.join(websiteRoot, 'js', 'course-data.js'));
  await mkdir(path.join(publicRoot, 'content'), { recursive: true });
  await writeFile(
    path.join(publicRoot, 'content', 'courses.json'),
    `${JSON.stringify(simplifyCourses(courseData), null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(publicRoot, 'content', 'assets.imported.json'),
    `${JSON.stringify(copied, null, 2)}\n`,
    'utf8'
  );

  console.log(`Copied ${copied.length} website assets.`);
  console.log('Generated public/content/courses.json and public/content/assets.imported.json.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
