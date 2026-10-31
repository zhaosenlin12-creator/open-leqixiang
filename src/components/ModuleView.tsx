import { ArrowRight, Award, BookOpen, CheckCircle2, ShieldCheck, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DisplayAsset, NormalizedContentBundle } from '../types/content';
import { MediaFrame } from './MediaFrame';

interface ModuleViewProps {
  moduleId: string;
  content: NormalizedContentBundle;
  assetMap: Map<string, DisplayAsset>;
  onOpenModule: (moduleId: string) => void;
  onOpenTour: (tourId: string) => void;
  onOpenPlaylist: () => void;
}

export function ModuleView({
  moduleId,
  content,
  assetMap,
  onOpenModule,
  onOpenTour,
  onOpenPlaylist
}: ModuleViewProps) {
  const module = content.modules.find((item) => item.id === moduleId);
  if (!module) {
    return <section className="page-section"><h1>模块不存在</h1></section>;
  }

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">乐启享展示模块</p>
          <h1>{module.title}</h1>
          <p>{module.summary}</p>
        </div>
        <MediaFrame asset={assetMap.get(module.coverAssetId ?? '')} label={module.title} />
      </div>

      {moduleId === 'quick-tours' && (
        <div className="list-grid">
          {content.tours.filter((tour) => tour.enabled).map((tour) => (
            <button key={tour.id} type="button" className="wide-action" onClick={() => onOpenTour(tour.id)}>
              <BookOpen size={24} />
              <span>{tour.title}</span>
              <small>{tour.estimatedMinutes}分钟 · {tour.nodes.length} 个节点</small>
            </button>
          ))}
        </div>
      )}

      {moduleId === 'strength' && (
        <div className="feature-layout">
          <Feature icon={<ShieldCheck />} title="系统课程" text="从启蒙搭建到代码编程和 AI 创赛，课程阶段清晰衔接。" />
          <Feature icon={<CheckCircle2 />} title="项目输出" text="每个阶段围绕作品、任务、表达和复盘形成可展示成果。" />
          <Feature icon={<Award />} title="竞赛路径" text="覆盖机器人、信息素养、蓝桥杯、CSP/NOIP 等不同成长方向。" />
          <Feature icon={<Users />} title="小班互动" text="强调动手实践、表达展示、协作和课堂反馈。" />
        </div>
      )}

      {moduleId === 'courses' && (
        <>
          <div className="course-path">
            {content.courses.routes.map((route) => (
              <div key={route.id} className="route-block">
                <h2>{route.name}</h2>
                <p>{route.description}</p>
                <div className="route-chain">
                  {route.path.map((courseId) => (
                    <span key={courseId}>{content.courses.stages.find((course) => course.id === courseId)?.name ?? courseId}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="course-grid">
            {content.courses.stages.map((course) => (
              <article key={course.id} className="course-card" style={{ borderTopColor: course.color ?? '#0b3aa8' }}>
                <h2>{course.name}</h2>
                <strong>{course.ageRange}</strong>
                <p>{course.tagline}</p>
                <ul>
                  {course.highlights.slice(0, 4).map((highlight) => <li key={highlight}>{highlight}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </>
      )}

      {moduleId === 'achievements' && (
        <div className="split-content">
          <div>
            <h2>赛事地图</h2>
            {content.achievements.competitions.map((competition) => (
              <article key={competition.id} className="line-item">
                <h3>{competition.title}</h3>
                <p>{competition.summary}</p>
              </article>
            ))}
          </div>
          <div className="showcase-column">
            {content.achievements.showcases.map((showcase) => (
              <article key={showcase.id} className="showcase-item">
                <MediaFrame asset={assetMap.get(showcase.assetId ?? '')} label={showcase.title} />
                <h3>{showcase.title}</h3>
                <p>{showcase.summary}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      {moduleId === 'staff' && (
        <div className="capability-panel">
          <h2>师资能力展示模板</h2>
          <p>当前没有真实师资资料，第一版只展示能力方向；后续提供真实教师资料后可替换为个人卡片。</p>
          <div className="capability-grid">
            {content.staff.capabilities.map((capability) => <span key={capability}>{capability}</span>)}
          </div>
        </div>
      )}

      {moduleId === 'students' && (
        <div className="empty-state">
          <h2>学员风采待人工精选</h2>
          <p>附件素材默认不自动公开。把已授权照片、作品和成长故事加入配置后，这里会展示照片墙和作品集。</p>
        </div>
      )}

      {moduleId === 'pricing' && (
        <div className="split-content">
          <div>
            <h2>公共展示</h2>
            <p>{content.pricing.public.range}</p>
            <ul className="check-list">
              {content.pricing.public.highlights.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="media-strip">
            {content.pricing.advisor.assets.map((assetId) => (
              <MediaFrame key={assetId} asset={assetMap.get(assetId)} fit="contain" />
            ))}
          </div>
        </div>
      )}

      {moduleId === 'announcements' && (
        <div className="list-grid">
          {content.playlists.map((item) => (
            <article key={item.id} className="line-item">
              <h3>{item.title}</h3>
              <p>{item.type} · {item.duration ?? content.site.settings.defaultSlideSeconds} 秒</p>
            </article>
          ))}
          <button type="button" className="wide-action" onClick={onOpenPlaylist}>
            <ArrowRight size={24} />
            <span>播放当前轮播清单</span>
            <small>图片、视频、课程页混合展示</small>
          </button>
        </div>
      )}

      <div className="bottom-actions">
        <button type="button" className="text-button" onClick={() => onOpenModule('courses')}>
          <BookOpen size={20} />课程体系
        </button>
        <button type="button" className="text-button" onClick={() => onOpenTour('quick-intro')}>
          <ArrowRight size={20} />3分钟导览
        </button>
        <button type="button" className="text-button primary" onClick={onOpenPlaylist}>
          进入轮播
        </button>
      </div>
    </section>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="feature-item">
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </article>
  );
}
