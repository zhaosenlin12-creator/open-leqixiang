import { Home } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  getActivePlaylistItems,
  getNextPlaylistItem,
  getPlaylistItemDuration
} from '../lib/playlist';
import type { DisplayAsset, NormalizedContentBundle, PlaylistItem } from '../types/content';
import { MediaFrame } from './MediaFrame';

interface PlaylistPlayerProps {
  content: NormalizedContentBundle;
  assetMap: Map<string, DisplayAsset>;
  onExit: () => void;
  onOpenModule: (moduleId: string) => void;
}

export function PlaylistPlayer({ content, assetMap, onExit, onOpenModule }: PlaylistPlayerProps) {
  const activeItems = useMemo(() => getActivePlaylistItems(content.playlists), [content.playlists]);
  const [index, setIndex] = useState(0);
  const item = activeItems[index % Math.max(activeItems.length, 1)];

  useEffect(() => {
    if (!item) return;
    const seconds = getPlaylistItemDuration(item, content.site.settings.defaultSlideSeconds);
    const timeout = window.setTimeout(() => {
      setIndex((current) => {
        const currentItem = activeItems[current % activeItems.length];
        return activeItems.indexOf(getNextPlaylistItem(activeItems, activeItems.indexOf(currentItem))) ;
      });
    }, seconds * 1000);
    return () => window.clearTimeout(timeout);
  }, [activeItems, content.site.settings.defaultSlideSeconds, item]);

  if (!item) {
    return (
      <section className="playlist-player" onPointerDown={onExit}>
        <h1>暂无轮播内容</h1>
      </section>
    );
  }

  return (
    <section className="playlist-player" onPointerDown={onExit}>
      <button type="button" className="playlist-home" onClick={onExit} title="退出轮播">
        <Home size={28} />
      </button>
      <div className="playlist-stage">
        <PlaylistVisual item={item} content={content} assetMap={assetMap} onOpenModule={onOpenModule} />
      </div>
      <div className="playlist-caption">
        <span>{item.title}</span>
        <small>{index + 1} / {activeItems.length}</small>
      </div>
    </section>
  );
}

function PlaylistVisual({
  item,
  content,
  assetMap,
  onOpenModule
}: {
  item: PlaylistItem;
  content: NormalizedContentBundle;
  assetMap: Map<string, DisplayAsset>;
  onOpenModule: (moduleId: string) => void;
}) {
  if (item.assetId) {
    return <MediaFrame asset={assetMap.get(item.assetId)} fit={item.type === 'video' ? 'cover' : 'contain'} autoplay />;
  }

  if (item.type === 'module' && item.refId) {
    const module = content.modules.find((entry) => entry.id === item.refId);
    return (
      <button type="button" className="playlist-info-page" onClick={() => onOpenModule(item.refId!)}>
        <h1>{module?.title ?? item.title}</h1>
        <p>{module?.summary}</p>
      </button>
    );
  }

  if (item.type === 'pricing') {
    return (
      <div className="playlist-info-page">
        <h1>价格权益</h1>
        <ul>
          {content.pricing.public.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className="playlist-info-page">
      <h1>{item.title}</h1>
      <p>内容已进入本地轮播清单。</p>
    </div>
  );
}

