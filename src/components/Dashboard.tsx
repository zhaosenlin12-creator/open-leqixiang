import { Award, BookOpen, Presentation, Sparkles, Users, Video } from 'lucide-react';
import { getEnabledModules } from '../lib/content';
import type { DisplayAsset, NormalizedContentBundle } from '../types/content';
import { MediaFrame } from './MediaFrame';

interface DashboardProps {
  content: NormalizedContentBundle;
  assetMap: Map<string, DisplayAsset>;
  onOpenModule: (moduleId: string) => void;
  onOpenTour: (tourId: string) => void;
  onOpenPlaylist: () => void;
}

export function Dashboard({
  content,
  assetMap,
  onOpenModule,
  onOpenTour,
  onOpenPlaylist
}: DashboardProps) {
  const modules = getEnabledModules(content);
  const enabledTours = content.tours.filter((tour) => tour.enabled);
  const heroAsset = assetMap.get('hero-bg') ?? assetMap.get('classroom-7');

  return (
    <section className="dashboard">
      <div className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">本地触摸大屏 · 家长咨询导览</p>
          <h1>乐创未来，启享编程</h1>
          <p className="hero-text">
            从乐高搭建、机器人、Scratch、Python、C++ 到 AI 创赛营，构建 3-16 岁连续成长路径。
          </p>
          <div className="metric-row">
            <span><BookOpen size={20} />{content.courses.stages.length} 条课程主线</span>
            <span><Presentation size={20} />{enabledTours.length} 条导览路线</span>
            <span><Video size={20} />{content.playlists.length} 个轮播项</span>
          </div>
        </div>
        <MediaFrame asset={heroAsset} label="乐启享品牌视觉" />
      </div>

      <div className="tour-band">
        <div>
          <p className="eyebrow">快速导览</p>
          <h2>顾问接待时，从这里开始</h2>
        </div>
        <div className="tour-buttons">
          {enabledTours.map((tour) => (
            <button key={tour.id} type="button" onClick={() => onOpenTour(tour.id)}>
              <Sparkles size={20} />
              <span>{tour.title}</span>
              <small>{tour.estimatedMinutes}分钟</small>
            </button>
          ))}
          <button type="button" className="playlist-cta" onClick={onOpenPlaylist}>
            <Video size={20} />
            <span>进入自动轮播</span>
            <small>活动展示</small>
          </button>
        </div>
      </div>

      <div className="module-grid">
        {modules.map((module) => (
          <button key={module.id} type="button" className="module-card" onClick={() => onOpenModule(module.id)}>
            <MediaFrame asset={assetMap.get(module.coverAssetId ?? '')} label={module.title} />
            <span className="module-title">{module.title}</span>
            <span className="module-summary">{module.summary}</span>
          </button>
        ))}
      </div>

      <div className="trust-strip">
        <span><Award size={22} />竞赛路线</span>
        <span><Users size={22} />小班教学</span>
        <span><Sparkles size={22} />AI 融合</span>
      </div>
    </section>
  );
}

