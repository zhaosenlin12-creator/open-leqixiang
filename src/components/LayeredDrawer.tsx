import { X, Play, Pause, Maximize2, Volume2, VolumeX, SkipBack, SkipForward, RotateCcw, ExternalLink } from 'lucide-react';
import { ImageViewer } from './ImageViewer';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ExhibitionItem, SectionId } from '../data/exhibition';
import { nextIndex } from '../lib/exhibition';
import { extractPoster, getCachedPoster } from '../lib/videoPoster';
import type { ExpansionOrigin } from './OrbitGallery';

interface LayeredDrawerProps {
  item: ExhibitionItem | null;
  items: ExhibitionItem[];
  origin?: ExpansionOrigin;
  activeSection: SectionId;
  muted: boolean;
  backdropPaused?: boolean;
  onNavigate: (section: Exclude<SectionId, 'home'>) => void;
  onItemChange: (index: number) => void;
  onClose: () => void;
  onExited?: () => void;
  variant?: 'cinematic' | 'side-panel';
}

type CinematicStyle = CSSProperties & {
  '--origin-x': string;
  '--origin-y': string;
  '--origin-w': string;
  '--origin-h': string;
};

const EXIT_MS = 420;

interface ExternalLinkEntry {
  url: string;
  label?: string;
}

function ExternalLinks({
  links,
  singleUrl,
  singleLabel,
  defaultLabel
}: {
  links?: ExternalLinkEntry[];
  singleUrl?: string;
  singleLabel?: string;
  defaultLabel: string;
}) {
  const entries: ExternalLinkEntry[] = links && links.length > 0
    ? links
    : singleUrl
      ? [{ url: singleUrl, label: singleLabel }]
      : [];
  if (entries.length === 0) return null;
  return (
    <span className="cinematic-controls-buttons">
      {entries.map((entry) => (
        <a
          key={entry.url}
          className="cinematic-external-link"
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>{entry.label ?? defaultLabel}</span>
          <ExternalLink size={14} strokeWidth={1.8} />
        </a>
      ))}
    </span>
  );
}

export function LayeredDrawer({
  item,
  items,
  origin,
  muted,
  activeSection,
  onItemChange,
  onClose,
  onExited,
  variant = 'cinematic'
}: LayeredDrawerProps) {
  const [renderedItem, setRenderedItem] = useState<ExhibitionItem | null>(item);
  const [isClosing, setIsClosing] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerShellRef = useRef<HTMLDivElement | null>(null);

  const externalLinkLabel = "个人网站";
  const currentIndex = renderedItem ? Math.max(0, items.findIndex((entry) => entry.id === renderedItem.id)) : 0;

  const viewStyle = useMemo<CinematicStyle>(() => ({
    '--origin-x': `${origin?.x ?? window.innerWidth / 2}px`,
    '--origin-y': `${origin?.y ?? window.innerHeight / 2}px`,
    '--origin-w': `${origin?.width ?? 420}px`,
    '--origin-h': `${origin?.height ?? 260}px`
  }), [origin]);

  useEffect(() => {
    if (item) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setRenderedItem(item);
      setIsClosing(false);
      setMediaReady(false);
      return;
    }

    if (renderedItem && !isClosing) {
      setIsClosing(true);
      closeTimerRef.current = window.setTimeout(() => {
        setRenderedItem(null);
        setIsClosing(false);
        setMediaReady(false);
        closeTimerRef.current = null;
        onExited?.();
      }, EXIT_MS);
    } else if (!renderedItem) {
      setMediaReady(false);
    }
  }, [isClosing, item, onExited, renderedItem]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    setMediaReady(false);
  }, [renderedItem?.id]);

  useEffect(() => {
    setIsMuted(muted);
  }, [muted]);

  useEffect(() => {
    // Pull a poster out of the video itself the first time we open it.
    // Result is cached in localStorage so subsequent opens are instant.
    if (!renderedItem || renderedItem.mediaKind !== "video") {
      setPosterUrl(null);
      return;
    }
    const src = renderedItem.media;
    const cached = getCachedPoster(src);
    if (cached) {
      setPosterUrl(cached);
      return;
    }
    let cancelled = false;
    extractPoster(src).then((url) => {
      if (!cancelled) setPosterUrl(url);
    });
    return () => { cancelled = true; };
  }, [renderedItem?.id, renderedItem?.media, renderedItem?.mediaKind]);

  const requestClose = useCallback(() => {
    if (!renderedItem || isClosing) return;
    onClose();
  }, [isClosing, onClose, renderedItem]);

  // Ref-mirror the latest nav state so the keydown listener can be bound
  // once per open cycle instead of re-binding on every index change.
  const navStateRef = useRef({ currentIndex, itemsLength: items.length, onItemChange, requestClose });
  useEffect(() => {
    navStateRef.current = { currentIndex, itemsLength: items.length, onItemChange, requestClose };
  }, [currentIndex, items.length, onItemChange, requestClose]);

  useEffect(() => {
    if (!renderedItem) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const { currentIndex: ci, itemsLength: len, onItemChange: cb, requestClose: close } = navStateRef.current;
      if (event.key === 'Escape') { close(); return; }
      if (event.key === 'ArrowLeft') { cb(nextIndex(ci, len, -1)); return; }
      if (event.key === 'ArrowRight') { cb(nextIndex(ci, len)); return; }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [renderedItem]);

  const handleVideoReady = useCallback(() => {
    setMediaReady(true);
    const v = videoRef.current;
    if (v) {
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
      setCurrentTime(v.currentTime || 0);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.duration > 0) setProgress(v.currentTime / v.duration);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
    } else {
      v.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = playerShellRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
      return;
    }
    const elAny = el as any;
    const req: ((this: Element) => Promise<void>) | undefined =
      elAny.requestFullscreen || elAny.webkitRequestFullscreen || elAny.mozRequestFullScreen;
    if (req) {
      try { req.call(elAny); } catch (_) { /* noop */ }
    }
  }, []);

  const handleVideoClick = useCallback(() => {
    togglePlay();
  }, [togglePlay]);

  const handleSeek = useCallback((event: any) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
    setProgress(ratio);
  }, []);

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + delta));
  }, []);

  const restartVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => undefined);
  }, []);

  const formatTime = useCallback((value: number) => {
    if (!Number.isFinite(value) || value < 0) return '00:00';
    const total = Math.floor(value);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, []);

  if (!renderedItem) return null;

  return (
    <div className={`drawer-layer cinematic-layer ${isClosing ? 'is-closing is-pass-through' : ''} variant-${variant}`} role="presentation">
      <button type="button" className="drawer-backdrop cinematic-backdrop" onClick={requestClose} aria-label="关闭预览" />
      <section
        className={`cinematic-view accent-${renderedItem.accent} ${renderedItem.fit === 'contain' ? 'is-document' : ''} ${mediaReady ? 'is-ready' : 'is-pending'}`}
        style={viewStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="cinematic-toolbar">
          <span className="cinematic-eyebrow">{renderedItem.eyebrow}</span>
          <div className="cinematic-toolbar-actions">
            <button type="button" onClick={requestClose} aria-label="关闭预览" title="关闭">
              <X size={24} />
            </button>
          </div>
        </div>

        {renderedItem.mediaKind === 'video' ? (
          <div
            ref={playerShellRef}
            className={`video-player is-controls-visible ${mediaReady ? 'is-ready' : 'is-pending'} ${isPlaying ? 'is-playing' : 'is-paused'}`}
            key={renderedItem.id}
            onClick={handleVideoClick}
            onDoubleClick={toggleFullscreen}
          >
            {(renderedItem.poster || posterUrl) ? (
              <div
                className="video-player-poster-bg"
                style={{ backgroundImage: `url(${renderedItem.poster ?? posterUrl})` }}
                aria-hidden="true"
              />
            ) : null}
            <video
              ref={videoRef}
              className="video-player-video"
              src={renderedItem.media}
              poster={renderedItem.poster ?? posterUrl ?? undefined}
              autoPlay
              muted={isMuted}
              loop
              playsInline
              preload="none"
              onLoadedData={handleVideoReady}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={() => setMediaReady(true)}
            />
            <button
              type="button"
              className="video-player-play-overlay"
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              aria-label={isPlaying ? '暂停' : '播放'}
              tabIndex={isPlaying ? -1 : 0}
            >
              {isPlaying ? <Pause size={44} strokeWidth={1.5} /> : <Play size={44} strokeWidth={1.5} />}
            </button>
            <div className="video-player-controls" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="video-player-btn video-player-btn--restart"
                onClick={restartVideo}
                aria-label="重新播放"
                title="重新播放"
              >
                <RotateCcw size={16} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className="video-player-btn video-player-btn--skip"
                onClick={() => seekBy(-10)}
                aria-label="后退 10 秒"
                title="后退 10 秒"
              >
                <SkipBack size={16} strokeWidth={1.8} />
                <em>-10s</em>
              </button>
              <div className="video-player-progress" onClick={handleSeek}>
                <div className="video-player-progress-bar" style={{ width: `${progress * 100}%` }} />
                <div className="video-player-progress-thumb" style={{ left: `${progress * 100}%` }} />
              </div>
              <span className="video-player-time">
                <strong>{formatTime(currentTime)}</strong>
                <em>/ {formatTime(duration)}</em>
              </span>
              <button
                type="button"
                className="video-player-btn video-player-btn--mute"
                onClick={toggleMute}
                aria-label={isMuted ? '取消静音' : '静音'}
                title={isMuted ? '取消静音' : '静音'}
              >
                {isMuted ? <VolumeX size={18} strokeWidth={1.8} /> : <Volume2 size={18} strokeWidth={1.8} />}
              </button>
              <button
                type="button"
                className="video-player-btn video-player-btn--fullscreen"
                onClick={toggleFullscreen}
                aria-label="全屏播放"
                title="全屏播放"
              >
                <Maximize2 size={18} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        ) : (
          <div className={`cinematic-stage ${mediaReady ? 'is-ready' : 'is-pending'}`} key={renderedItem.id}>
            <ImageViewer
              src={renderedItem.media}
              alt={renderedItem.title}
              fit={renderedItem.fit === 'cover' ? 'cover' : 'contain'}
              onClose={onClose}
            />
            <div className="cinematic-stage-glow" aria-hidden="true" />
          </div>
        )}

        {renderedItem.mediaKind === 'video' ? (
          <div className="cinematic-caption cinematic-caption--minimal" key={`caption-${renderedItem.id}`}>
            <div className="cinematic-caption-body">
              <div className="cinematic-caption-head">
                <span className="cinematic-caption-eyebrow">{renderedItem.eyebrow}</span>
                <h2 id="drawer-title">{renderedItem.title}</h2>
                <div className="cinematic-caption-tags">
                  {renderedItem.tags.slice(0, 3).map((tag) => <em key={tag}>{tag}</em>)}
                </div>
              </div>
              <div className="cinematic-controls-row">
                <small className="cinematic-counter-small">
                  {String(currentIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
                </small>
              
              <ExternalLinks links={renderedItem.externalLinks} singleUrl={renderedItem.externalUrl} singleLabel={renderedItem.externalLabel} defaultLabel={externalLinkLabel} />
            </div>
            </div>
          </div>
        ) : (
          <div className="cinematic-caption" key={`caption-${renderedItem.id}`}>
            <div className="cinematic-caption-body">
              <div className="cinematic-caption-head">
                <span className="cinematic-caption-eyebrow">{renderedItem.eyebrow}</span>
                <h2 id="drawer-title">{renderedItem.title}</h2>
                <p>{renderedItem.description}</p>
              </div>
              <div className="cinematic-caption-side">
                <ul>
                  {renderedItem.details.slice(0, 3).map((detail, index) => (
                    <li key={detail}>
                      <b>{String(index + 1).padStart(2, '0')}</b>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
                <div className="cinematic-caption-tags">
                  {renderedItem.tags.slice(0, 3).map((tag) => <em key={tag}>{tag}</em>)}
                </div>
              </div>
            </div>
            <div className="cinematic-controls-row">
              <small className="cinematic-counter-small">
                {String(currentIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
              </small>
              <ExternalLinks links={renderedItem.externalLinks} singleUrl={renderedItem.externalUrl} singleLabel={renderedItem.externalLabel} defaultLabel={externalLinkLabel} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
