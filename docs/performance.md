# 性能与加载优化说明

本项目面向线下展厅 kiosk：弱网 + 低配机 + 长时间运行。
下列优化让首屏可见时间从“等 30s 拉 200MB”降到“2s 内可交互”。

## 总览

| 维度           | 改前              | 改后                | 备注 |
| -------------- | ----------------- | ------------------- | ---- |
| 学员图总传输   | 193 MB            | 4.6 MB（thumb 360w）| 缩 97% |
| 其他 section 图 | ~50 MB           | 2.85 MB（thumb 480w）| 缩 94% |
| 视频自动预加载 | 54 MB `preload=auto` | 0，改为 `metadata`/`none` | 等用户主动进入再加载 |
| 首屏 JS        | 271 KB            | 248 KB              | -23 KB |
| 首屏 CSS       | 64 KB 同步阻塞    | 200B 内联 + 64KB 异步 | 不阻塞首屏 |
| 视差渲染       | 每帧 setState     | ref + CSS 变量直写  | 0 React 渲染 |
| 隐藏 section   | 持续 rAF 自滚     | IO 触发暂停         | 节省 CPU |

## 文件改动

```
scripts/
  build-student-manifest.mjs    学员图 manifest 生成
  generate-student-thumbs.mjs   学员 360w/1280w webp
  generate-section-thumbs.mjs   其他 section 缩略图
  postbuild-css-defer.mjs       构建后异步 CSS 注入
  emit-cache-headers.mjs        Caddy / nginx 缓存头配置
  refresh-student-photos.mjs    扩展为同时重建 manifest

src/lib/
  studentArchive.ts             manifest + thumb resolver
  videoPoster.ts                视频首帧抽帧 + localStorage 缓存
  perf.ts                       轻量 LCP/CLS/INP/longtask 观察器

src/components/
  HeroCarousel.tsx              视差改 ref，video 用 poster + section thumb
  CategoryStage.tsx             视差改 ref，img 用 section thumb
  OrbitGallery.tsx              img 用 section thumb，抽帧超时 1s
  StudentGallery.tsx            img 用学员 thumb + IntersectionObserver
  LayeredDrawer.tsx             video 用动态 poster
  ExhibitionHeader.tsx          nav hover 预取 students thumbs + CategoryStage chunk
  App.tsx                       React.lazy 切分三个大组件

public/
  students-manifest.json         152 个学员文件名（5.3 KB）
  students-thumbs-manifest.json  thumb/large 路径映射
  sections-thumbs-manifest.json  71 个其他图片 thumb/large 映射
  students/thumb/ + large/      学员 webp
  about,staff,courses,.../thumb + large/  其他 webp
  dist/_cache-headers.{caddy,nginx.conf}  部署配置

index.html                       logo preload + 异步 CSS + critical 内联
```

## 运行时行为

### 学员图（StudentGallery）

- 进入首页：主 bundle 加载；`main.tsx` 调 `warmStudentGallery(2000, 12)`
- `requestIdleCallback` 触发后，并行预热前 12 张学员 360w webp
- 进入 students 页面：`StudentGallery` mount 时拉 `students-manifest.json`（5.3 KB） + thumbs manifest（30+ KB）
- 每个 `<img>` 用 `resolveStudentThumb()` 把 `/images/students/xxx.jpg` 替换为 `/students/thumb/xxx.webp`
- 数据属性 `data-full` 保留原图路径；用户点开大图（`onError` 兜底）才用原图

### 视频首帧

- `LayeredDrawer` 打开视频前，`useEffect` 查 `localStorage` 是否已有 poster
- 没有就 `extractPoster(src)`：创建离屏 `<video>`，`loadedmetadata` → `currentTime = min(0.5, duration*0.1)` → `seeked` → canvas → 480x270 jpeg dataURL
- 写入 `localStorage`，key 为 `leqx.poster.v1.<src>`
- 4MB 预算；超出按 LRU 淘汰
- 失败（跨域 tainted canvas、metadata 不就绪 8s）→ 不展示 poster，浏览器走默认黑屏 + video poster attr

### CSS 关键路径

- `dist/index.html` 内联 ~200B critical（`html/body/#root` 背景与最小布局）
- 完整 CSS（64 KB）以 `<link rel="preload" as="style" onload="this.rel='stylesheet'">` 异步加载
- `<noscript>` fallback 防止 JS 关掉时全白
- Postbuild 脚本 `scripts/postbuild-css-defer.mjs` 自动注入（每次 build 重新跑）

### 视频预加载策略

| 组件               | preload 属性 | poster | 说明 |
| ------------------ | ------------ | ------ | ---- |
| HeroCarousel 非 active | `none`    | item.poster ?? 动态抽帧 | 切到当前才 `metadata` |
| HeroCarousel active    | `metadata` | 同上 | 视频文件本身加载到首帧就停 |
| CategoryStage backdrop | `none`    | — | 用户切到此 section 时才 set `metadata` |
| LayeredDrawer     | `none`       | item.poster ?? 动态抽帧 | 点开时抽帧缓存 + `metadata` 加载 |
| OrbitGallery active | `none`     | — | 同上 |

## 部署

### 内置 cache 头

```
dist/_cache-headers.caddy
dist/_cache-headers.nginx.conf
```

- `/assets/*` 哈希文件 → `public, max-age=31536000, immutable`（一年）
- `/index.html` → `no-cache, must-revalidate`（每次回源拿最新）
- `/images/*` → `public, max-age=2592000`（30 天）
- 文本类型启用 gzip / brotli
- 视频/jpg/png/webp 不再二次压缩（已压缩）

### 启动

```
npm run build            # 一次：tsc + vite + css defer + cache headers
npm run preview          # vite preview @ 4173
```

### 学员图管理

加新图：

```
cp newphoto.jpg public/images/students/
node scripts/refresh-student-photos.mjs   # 同步更新 manifest
node scripts/generate-student-thumbs.mjs   # 生成 thumb/large webp
```

`refresh-student-photos.mjs` 会扫描 `public/images/students/`，重写 `src/data/exhibition.ts` 的 supplement + copy block，**并重建** `students-manifest.json`。
`generate-student-thumbs.mjs` 幂等：已存在的 webp 跳过。

## 验证命令

```
npm run build   # tsc + vite + postbuild + cache-headers
npm test        # 6 files, 20 tests
```

测试覆盖：
- 中文字符无 mojibake
- 媒体路径全部 `existsSync`（原图必须保留）
- `styles.css` 包含 `cursor: grab`、`cinematic-view`、不含 `detail-drawer`

## 已知限制

- ffmpeg 不可用时 `home/huodong.mp4`（54 MB）无法自动转码；详见 `docs/performance.md` 的“视频压缩”小节
- 视频首帧在首次打开时抽帧（< 2s 完成），缓存后二次打开立即可见
- localStorage 容量受浏览器/系统限制；`videoPoster.ts` 的 `CACHE_BYTES_BUDGET` 4MB 是保守值
- sharp 是 devDependency（不入 bundle），只在 build 阶段用
