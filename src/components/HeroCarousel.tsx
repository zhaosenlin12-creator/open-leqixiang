import { ArrowRight, Volume2, VolumeX } from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExhibitionItem } from '../data/exhibition';
import { nextIndex } from '../lib/exhibition';
import { extractPoster, getCachedPoster } from '../lib/videoPoster';
import { prefetchSectionThumbs, resolveSectionThumb } from '../lib/studentArchive';

interface HeroCarouselProps {
  items: ExhibitionItem[];
  activeIndex: number;
  isPlaying: boolean;
  muted: boolean;
  onActiveIndexChange: (index: number) => void;
  onOpenDetails: (item: ExhibitionItem) => void;
  onComplete?: () => void;
}

const HERO_AUTOPLAY_MS = 3500;   // image slide hold time (was 4500: keep the hero moving into the tour faster)
// Video slides wait for the clip to actually finish (`ended`). The cap below
// is dynamic — once metadata is known it is video duration + slack, so a
// normally playing clip is never cut short. The cap only exists to stop a
// truly stuck clip from freezing the carousel forever.
const HERO_VIDEO_END_PAD_MS = 2000;      // slack added to the video duration
const HERO_VIDEO_MAX_FALLBACK_MS = 20000; // cap when metadata never arrives
const HERO_VIDEO_MAX_CAP_MS = 60000;     // absolute ceiling (very long clips)
const HERO_VIDEO_STALL_MS = 5000;        // advance early only if playback never starts

/** Mute/unmute the active video and start playback when rolling. */
function startActiveVideo(video: HTMLVideoElement, isPlaying: boolean, muted: boolean): void {
  video.muted = muted;
  video.volume = muted ? 0 : 1;
  if (!isPlaying) {
    video.pause();
    return;
  }
  const startPlayback = () => {
    try {
      video.currentTime = 0;
    } catch {
      /* some browsers throw if metadata not ready; ignore */
    }
    void video.play().catch(() => undefined);
  };
  if (video.readyState >= 1) {
    startPlayback();
  } else {
    const onMeta = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      startPlayback();
    };
    video.addEventListener('loadedmetadata', onMeta);
  }
}

function HeroCarouselInner({
  items,
  activeIndex,
  isPlaying,
  muted,
  onActiveIndexChange,
  onOpenDetails,
  onComplete
}: HeroCarouselProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  // Pointer position is consumed by CSS variables only; reading it from
  // useState would re-render the whole carousel on every mouse move.
  const pointerRef = useRef({ x: 36, y: 64 });
  const posterBySrcRef = useRef<Map<string, string>>(new Map());
  const [posterTick, setPosterTick] = useState(0);
  const rememberPoster = useCallback((srcKey: string, url: string) => {
    const map = posterBySrcRef.current;
    if (map.get(srcKey) === url) return;
    map.set(srcKey, url);
    setPosterTick((t) => t + 1);
  }, []);
  const activeItem = useMemo(() => items[activeIndex], [items, activeIndex, posterTick]);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  // One advance path for every trigger (image timer, video ended, video cap,
  // video stall). After the last slide the whole tour moves on: the parent
  // (App) rotates home -> section1 -> ... -> home, so the hero always hands
  // the tour to the next section instead of looping inside itself. Manual
  // bead clicks only jump to the selected slide; they do not lock the tour.
  const goForward = useCallback(() => {
    const isLast = activeIndex === items.length - 1;
    if (isLast) {
      onComplete?.();
    } else {
      onActiveIndexChange(nextIndex(activeIndex, items.length));
    }
  }, [activeIndex, items.length, onActiveIndexChange, onComplete]);

  // Image slides use a fixed timer; video slides are capped below.
  useEffect(() => {
    clearAdvanceTimer();
    if (!isPlaying || items.length <= 1) return;
    if (activeItem.mediaKind === 'video') return;
    advanceTimerRef.current = window.setTimeout(goForward, HERO_AUTOPLAY_MS);
    return clearAdvanceTimer;
  }, [activeIndex, isPlaying, items.length, activeItem.mediaKind, goForward, clearAdvanceTimer]);

  // Decode and cache the first video frame as a poster so the very
  // first paint of the hero has something behind the auto-played video.
  useEffect(() => { prefetchSectionThumbs(); }, []);

  const firstVideo = useMemo(() => items.find((it) => it.mediaKind === "video"), [items]);
  useEffect(() => {
    const first = firstVideo;
    if (!first) return;
    // If the slide already ships an explicit poster (small webp), don't
    // fetch the whole video just to extract a frame — that wasted a
    // multi-MB request on first paint.
    if (first.poster) return;
    if (posterBySrcRef.current.has(first.media)) return;
    const cached = getCachedPoster(first.media);
    if (cached) { rememberPoster(first.media, cached); return; }
    let cancelled = false;
    extractPoster(first.media).then((url) => {
      if (cancelled || !url) return;
      rememberPoster(first.media, url);
    });
    return () => { cancelled = true; };
  }, [firstVideo, rememberPoster]);

  // Drive the active video: only the active slide plays; every other video
  // stays paused and rewound so no off-screen audio bleeds through.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      // The ref can still be missing on the first commit of a freshly mounted
      // video; retry on the next tick so the new video still starts.
      const id = window.setTimeout(() => {
        const v = videoRef.current;
        if (v) startActiveVideo(v, isPlaying, muted);
      }, 0);
      return () => window.clearTimeout(id);
    }
    startActiveVideo(video, isPlaying, muted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, isPlaying, muted]);

  // Advancement rules for the active video slide:
  //   1. `ended` fires -> advance immediately (the clip finished playing).
  //   2. Dynamic cap: metadata known -> duration + END_PAD, so a normally
  //      playing clip is never cut short; metadata unknown -> fallback cap.
  //   3. Stall guard: if the video never starts rolling (autoplay rejected,
  //      still buffering after 5s) -> advance so the hero never freezes.
  // A video that is playing normally is NEVER advanced by a fixed timer.
  useEffect(() => {
    const video = videoRef.current;
    if (!isPlaying || activeItem.mediaKind !== 'video') return;
    const timers: number[] = [];
    const advance = () => goForward();
    const onEnded = () => advance();
    if (video) video.addEventListener('ended', onEnded);

    const scheduleCap = () => {
      if (!video) return;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration > 0) {
        const capMs = Math.min(
          duration * 1000 + HERO_VIDEO_END_PAD_MS,
          HERO_VIDEO_MAX_CAP_MS
        );
        timers.push(window.setTimeout(advance, capMs));
      } else {
        timers.push(window.setTimeout(advance, HERO_VIDEO_MAX_FALLBACK_MS));
      }
    };
    if (video && video.readyState >= 1) {
      scheduleCap();
    } else if (video) {
      const onMeta = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        scheduleCap();
      };
      video.addEventListener('loadedmetadata', onMeta);
      // If metadata never arrives (weak network), never freeze the hero.
      timers.push(window.setTimeout(advance, HERO_VIDEO_MAX_FALLBACK_MS));
    }

    // A kiosk/automation browser may reject the first autoplay attempt (e.g.
    // stale user-activation timing). Retry once after the element is settled.
    timers.push(window.setTimeout(() => {
      if (!video) return;
      if (!video.paused && !video.ended) return;
      video.muted = muted;
      void video.play().catch(() => undefined);
    }, 1500));

    // Stall guard: only advance early when the video is genuinely not
    // rolling (still buffering or playback rejected). A video that is
    // currently playing is left alone to reach `ended`.
    timers.push(window.setTimeout(() => {
      if (!video) return;
      const stillBuffering = video.readyState < 2;
      const notRolling = video.paused || video.ended;
      if (stillBuffering || notRolling) advance();
    }, HERO_VIDEO_STALL_MS));

    return () => {
      if (video) video.removeEventListener('ended', onEnded);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [activeIndex, activeItem.mediaKind, isPlaying, muted, goForward]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100
    };
    const el = sectionRef.current;
    if (el) {
      el.style.setProperty("--pointer-x", pointerRef.current.x + "%");
      el.style.setProperty("--pointer-y", pointerRef.current.y + "%");
    }
  }, []);

  // Stable per-bead click handlers, keyed by id. Each child button gets the
  // same function reference across renders, so even with many slides we don't
  // churn closures. Clicking a bead only selects that slide; the automatic
  // tour keeps advancing normally afterwards.
  const beadClicks = useMemo(() => {
    const map = new Map<string, () => void>();
    for (const item of items) {
      map.set(item.id, () => {
        onActiveIndexChange(items.indexOf(item));
      });
    }
    return map;
  }, [items, onActiveIndexChange]);
  const handleExplore = useCallback(() => {
    if (activeItem) onOpenDetails(activeItem);
  }, [activeItem, onOpenDetails]);

  return (
    <section
      ref={sectionRef}
      className="hero-carousel"
      aria-label="乐启享首页轮播"
      onPointerMove={handlePointerMove}
    >
      <div className="hero-aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      {items.map((item, index) => (
        <div
          className={`hero-slide ${index === activeIndex ? 'is-active' : ''} ${index < activeIndex ? 'is-past' : 'is-future'}`}
          key={item.id}
          aria-hidden={index !== activeIndex}
        >
          {item.mediaKind === 'video' && index === activeIndex ? (
            <video
              ref={videoRef}
              src={resolveSectionThumb(item.media) ?? item.media}
              muted={muted}
              playsInline
              preload="metadata"
              poster={item.poster ?? posterBySrcRef.current.get(item.media)}
              disablePictureInPicture
              disableRemotePlayback
            />
          ) : item.mediaKind === 'video' ? (
            <img
              src={item.poster ?? posterBySrcRef.current.get(item.media)}
              alt=""
              className="hero-slide-poster"
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
            />
          ) : (
            <img
              src={item.media}
              alt={item.title.replace('\n', ' ')}
              className={item.fit === 'contain' ? 'fit-contain' : ''}
              loading={index === activeIndex ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
              onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
            />
          )}
        </div>
      ))}

      <div className="hero-vignette" aria-hidden="true" />
      <div className="hero-grid" aria-hidden="true" />

      <div className="hero-copy-block" key={activeItem.id}>
        <span className="hero-eyebrow">
          <span className="hero-eyebrow-dot" /> {activeItem.eyebrow}
        </span>
        <h1>
          {activeItem.title.split('\n').map((line, lineIndex) => (
            <span key={lineIndex} className="hero-title-line">{line}</span>
          ))}
        </h1>
        <p className="hero-description">{activeItem.description}</p>
        <div className="hero-tags" aria-label="当前主题">
          {activeItem.tags.map((tag, tagIndex) => (
            <span key={tag} style={{ animationDelay: `${tagIndex * 80}ms` }}>{tag}</span>
          ))}
        </div>
      </div>

      <div className="hero-rail" aria-label="轮播进度">
        <div className="hero-counter">
          <strong>{String(activeIndex + 1).padStart(2, '0')}</strong>
          <span>/ {String(items.length).padStart(2, '0')}</span>
        </div>
        <div className="hero-rail-track">
          {items.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={`hero-rail-bead ${index === activeIndex ? 'is-active' : ''} ${index < activeIndex ? 'is-past' : ''}`}
              onClick={beadClicks.get(item.id)}
              aria-label={`切换到第 ${index + 1} 页：${item.title.replace('\n', ' ')}`}
            >
              <span className="hero-rail-bead-fill" />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="hero-explore"
          onClick={handleExplore}
          data-tooltip="查看详情"
        >
          <span className="hero-explore-label">查看</span>
          <ArrowRight size={20} />
          <span className="hero-explore-glow" />
        </button>
      </div>

      <div className="hero-mute-hint" aria-hidden="true">
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        <span>{muted ? '静音' : '声音已开'}</span>
      </div>
    </section>
  );
}

export const HeroCarousel = React.memo(HeroCarouselInner);
