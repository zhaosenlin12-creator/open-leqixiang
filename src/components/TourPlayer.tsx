import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  createTourState,
  goToNextTourStep,
  goToPreviousTourStep,
  setTourPlaying,
  type TourState
} from '../lib/tour';
import type { DisplayAsset, NormalizedContentBundle, TourNode } from '../types/content';
import { MediaFrame } from './MediaFrame';

interface TourPlayerProps {
  tourId: string;
  content: NormalizedContentBundle;
  assetMap: Map<string, DisplayAsset>;
  onOpenModule: (moduleId: string) => void;
  onBack: () => void;
}

export function TourPlayer({ tourId, content, assetMap, onOpenModule, onBack }: TourPlayerProps) {
  const tour = content.tours.find((item) => item.id === tourId) ?? content.tours[0];
  const initialState = useMemo(() => createTourState(tour), [tour]);
  const [state, setState] = useState<TourState>(initialState);

  useEffect(() => setState(initialState), [initialState]);

  useEffect(() => {
    if (!state.isPlaying || state.isComplete) return;
    const timeout = window.setTimeout(() => setState((current) => goToNextTourStep(current)), state.currentNode.duration * 1000);
    return () => window.clearTimeout(timeout);
  }, [state.currentIndex, state.currentNode.duration, state.isComplete, state.isPlaying]);

  return (
    <section className="tour-player">
      <button type="button" className="text-button back-button" onClick={onBack}>
        <ArrowLeft size={20} />返回首页
      </button>

      <div className="tour-main">
        <div className="tour-copy">
          <p className="eyebrow">{tour.title}</p>
          <h1>{state.currentNode.title}</h1>
          <p>{renderNodeBody(state.currentNode, content)}</p>
          <div className="tour-progress">
            {tour.nodes.map((node, index) => (
              <span key={node.id} className={index <= state.currentIndex ? 'active' : ''} />
            ))}
          </div>
        </div>
        <NodeVisual node={state.currentNode} content={content} assetMap={assetMap} />
      </div>

      <div className="player-controls">
        <button type="button" className="icon-button large" onClick={() => setState((current) => goToPreviousTourStep(current))} title="上一页">
          <ChevronLeft size={32} />
        </button>
        <button
          type="button"
          className="icon-button large"
          onClick={() => setState((current) => setTourPlaying(current, !current.isPlaying))}
          title={state.isPlaying ? '暂停' : '播放'}
        >
          {state.isPlaying ? <Pause size={32} /> : <Play size={32} />}
        </button>
        <button type="button" className="icon-button large" onClick={() => setState((current) => goToNextTourStep(current))} title="下一页">
          <ChevronRight size={32} />
        </button>
        {state.currentNode.refId && (
          <button type="button" className="text-button primary" onClick={() => onOpenModule(state.currentNode.refId!)}>
            打开详情
          </button>
        )}
      </div>
    </section>
  );
}

function renderNodeBody(node: TourNode, content: NormalizedContentBundle): string {
  if (node.body) return node.body;
  if (node.type === 'course' && node.refId) {
    const course = content.courses.stages.find((item) => item.id === node.refId);
    return course ? `${course.ageRange} · ${course.tagline}。${course.description}` : '课程内容待补充。';
  }
  if (node.type === 'module' && node.refId) {
    return content.modules.find((item) => item.id === node.refId)?.summary ?? '模块内容待补充。';
  }
  if (node.type === 'asset') return '当前页面展示本地素材，可用于顾问讲解和活动现场播放。';
  return '围绕家长关心的问题，用一页讲清一个重点。';
}

function NodeVisual({
  node,
  content,
  assetMap
}: {
  node: TourNode;
  content: NormalizedContentBundle;
  assetMap: Map<string, DisplayAsset>;
}) {
  if (node.assetId) return <MediaFrame asset={assetMap.get(node.assetId)} fit="contain" autoplay />;
  if (node.type === 'course' && node.refId) {
    const course = content.courses.stages.find((item) => item.id === node.refId);
    return (
      <div className="node-panel">
        <h2>{course?.name ?? node.title}</h2>
        <p>{course?.ageRange}</p>
        <ul>{course?.highlights.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    );
  }
  return <MediaFrame asset={assetMap.get('classroom-7')} label={node.title} />;
}

