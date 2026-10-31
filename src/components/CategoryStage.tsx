import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { ExhibitionItem, SectionContent } from '../data/exhibition';
import { prefetchSectionThumbs, resolveSectionThumb } from '../lib/studentArchive';
import { nextIndex } from '../lib/exhibition';
import { OrbitGallery } from './OrbitGallery';
import type { ExpansionOrigin } from './OrbitGallery';
import { StudentGallery } from './StudentGallery';

interface CategoryStageProps {
  section: SectionContent;
  isTourPlaying: boolean;
  isDetailOpen: boolean;
  muted?: boolean;
  onOpenDetails: (item: ExhibitionItem, items: ExhibitionItem[], origin?: ExpansionOrigin) => void;
  onComplete?: () => void;
}

type StageStyle = CSSProperties & {
  '--stage-x': string;
  '--stage-y': string;
};

const IMAGE_HOLD_MS = 5000;
// 每个分类自动巡演的整体停留上限：学员墙是超长列表（152 张照片），
// 课程/荣誉等也有十几到二十几张内容，按张轮完需要一两分钟。
// 巡演时分类整体最多停留这个时长就把 tour 交给下一分类；墙内/轨内的
// 高亮仍继续轮动。单个视频依然“播完再走”，只有分类总时长到上限才切。
const STUDENTS_SECTION_HOLD_MS = 25000;
const SECTION_HOLD_MAX_MS = 40000;
// Video cards wait for the clip to finish (`ended` / timeupdate near the end).
// The cap is dynamic — duration + slack once metadata is known — so a playing
// clip is never cut short. Caps only stop a genuinely stuck clip from holding
// the tour hostage.
const VIDEO_END_PAD_MS = 2000;
const VIDEO_MAX_FALLBACK_MS = 20000;
const VIDEO_MAX_CAP_MS = 60000;
const VIDEO_STALL_MS = 5000;

export function CategoryStage({
  section,
  isTourPlaying,
  isDetailOpen,
  onOpenDetails,
  onComplete,
  muted = false
}: CategoryStageProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => { prefetchSectionThumbs(); }, []);
  const stageRef = useRef<HTMLElement>(null);
  const pointerRef = useRef({ x: 50, y: 50 });
  const [isReelPlaying, setIsReelPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageHoldRef = useRef<number | null>(null);
  // Clamp activeIndex to the current section. Between renders the section
  // can change (parent passes a new section prop) before the reset effect
  // below has flushed setActiveIndex(0). Without the clamp we'd read
  // `section.items[staleIndex]` which is undefined, and every effect below
  // that depends on `activeItem.*` would throw and trip the error boundary.
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(section.items.length - 1, 0));
  const activeItem = useMemo(() => section.items[safeIndex] ?? section.items[0], [section.items, safeIndex]);

  useEffect(() => {
    setActiveIndex(0);
  }, [section.id]);

  // 分类整体停留上限：学员墙高亮轮动继续，但到点强制把巡演交给下一
  // 分类，避免超长列表（学员 152 张、课程 22 张、荣誉 18 张、奇点 15 个
  // 视频）让访客误以为轮播卡住。视频分类同样适用：单个视频播完再走，
  // 但分类总时长到上限即切下一分类。
  useEffect(() => {
    if (!isReelPlaying) return;
    const hold = section.id === 'students' ? STUDENTS_SECTION_HOLD_MS : SECTION_HOLD_MAX_MS;
    const id = window.setTimeout(() => onComplete?.(), hold);
    return () => window.clearTimeout(id);
  }, [isReelPlaying, section.id, onComplete]);

  // Track autoplay + drawer state together. The single source of truth
  // here is isReelPlaying, which downstream effects observe.
  useEffect(() => {
    setIsReelPlaying(isTourPlaying && !isDetailOpen);
  }, [isTourPlaying, isDetailOpen]);

  const advance = useCallback((delta: number) => {
    // `safeIndex` is what we trust; we intentionally ignore the raw activeIndex
    // because a previous render may have left it past the new section's end.
    const length = section.items.length;
    if (length === 0) {
      onComplete?.();
      return;
    }
    const next = safeIndex + delta;
    if (next >= length || next < 0) {
      // End of the section: signal the orchestrator and freeze on the
      // final card. The parent decides what to show next.
      onComplete?.();
      return;
    }
    setActiveIndex(next);
  }, [safeIndex, section.items.length, onComplete]);

  // Auto-reel scheduling: video waits for onEnded, image waits IMAGE_HOLD_MS.
  useEffect(() => {
    if (!isReelPlaying) {
      if (imageHoldRef.current !== null) {
        window.clearTimeout(imageHoldRef.current);
        imageHoldRef.current = null;
      }
      const video = videoRef.current;
      if (video) {
        video.pause();
      }
      return;
    }
    if (activeItem.mediaKind === 'video') {
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        void video.play().catch(() => undefined);
      }
      // The clip advances via onEnded / timeupdate (see the handlers below).
      // The fallback cap is dynamic: duration + slack once metadata is known,
      // otherwise a generous default. A normally playing video is never cut.
      const scheduleCap = () => {
        const v = videoRef.current;
        if (!v) return;
        const duration = Number.isFinite(v.duration) ? v.duration : 0;
        if (duration > 0) {
          imageHoldRef.current = window.setTimeout(
            () => advance(1),
            Math.min(duration * 1000 + VIDEO_END_PAD_MS, VIDEO_MAX_CAP_MS)
          );
        } else {
          imageHoldRef.current = window.setTimeout(() => advance(1), VIDEO_MAX_FALLBACK_MS);
        }
      };
      let onMeta: (() => void) | null = null;
      if (video && video.readyState >= 1) {
        scheduleCap();
      } else if (video) {
        onMeta = () => {
          video.removeEventListener('loadedmetadata', onMeta!);
          scheduleCap();
        };
        video.addEventListener('loadedmetadata', onMeta);
        imageHoldRef.current = window.setTimeout(() => advance(1), VIDEO_MAX_FALLBACK_MS);
      }
      // Stall guard: only advance early when the video is genuinely not
      // rolling (still buffering or playback rejected).
      const stallId = window.setTimeout(() => {
        const v = videoRef.current;
        if (!v) return;
        const stillBuffering = v.readyState < 2;
        const notRolling = v.paused || v.ended;
        if (stillBuffering || notRolling) advance(1);
      }, VIDEO_STALL_MS);
      return () => {
        if (imageHoldRef.current !== null) {
          window.clearTimeout(imageHoldRef.current);
          imageHoldRef.current = null;
        }
        window.clearTimeout(stallId);
        if (video && onMeta) video.removeEventListener('loadedmetadata', onMeta);
      };
    }
    imageHoldRef.current = window.setTimeout(() => {
      advance(1);
    }, IMAGE_HOLD_MS);
    return () => {
      if (imageHoldRef.current !== null) {
        window.clearTimeout(imageHoldRef.current);
        imageHoldRef.current = null;
      }
    };
  }, [activeIndex, activeItem.mediaKind, advance, isReelPlaying]);

  // Some browsers don't reliably fire `ended` for short or auto-played videos.
  // Use timeupdate as a backup: if we're within 0.25s of the duration, advance.
  // Guard with a ref so multiple timeupdate ticks don't fire advance() repeatedly.
  const videoEndFiredRef = useRef<string | null>(null);
  useEffect(() => {
    videoEndFiredRef.current = null;
  }, [activeItem.id]);
  const handleVideoTimeUpdate = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!isReelPlaying) return;
    const video = event.currentTarget;
    if (!video.duration || Number.isNaN(video.duration)) return;
    if (videoEndFiredRef.current === activeItem.id) return;
    if (video.currentTime >= video.duration - 0.25) {
      videoEndFiredRef.current = activeItem.id;
      advance(1);
    }
  }, [activeItem.id, advance, isReelPlaying]);

  const handlePointerLeave = useCallback(() => {
    pointerRef.current = { x: 50, y: 50 };
    const el = stageRef.current;
    if (el) {
      el.style.setProperty("--stage-x", "50%");
      el.style.setProperty("--stage-y", "50%");
    }
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    pointerRef.current = { x, y };
    const el = stageRef.current;
    if (el) {
      el.style.setProperty("--stage-x", x + "%");
      el.style.setProperty("--stage-y", y + "%");
    }
  }, []);

  return (
    <section
      ref={stageRef}
      className={`category-stage category-${section.id} ${isReelPlaying ? 'is-reel' : ''}`}
      aria-labelledby={`${section.id}-title`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className={`category-backdrop ${section.id === 'students' ? 'category-backdrop-students' : ''}`} key={activeItem.id}>
        {activeItem.mediaKind === 'video' ? (
          <video
            key={activeItem.id}
            ref={videoRef}
            src={activeItem.media}
            poster={activeItem.poster}
            muted={muted}
            autoPlay
            loop={!isReelPlaying}
            playsInline
            preload="none"
            onEnded={isReelPlaying ? () => advance(1) : undefined}
            onTimeUpdate={isReelPlaying ? handleVideoTimeUpdate : undefined}
          />
        ) : (
          <img
            src={activeItem.media}
            alt={activeItem.title}
            className={activeItem.fit === 'contain' ? 'fit-contain' : ''}
          />
        )}
        {section.id === 'students' && (
          <>
            <div className="student-backdrop-aura" />
            <div className="student-backdrop-grid" />
          </>
        )}
      </div>
      <div className="category-scrim" />
      <div className="category-light-field" aria-hidden="true" />

      {section.id !== 'students' && (
        <div className="category-heading">
          <span className="category-number">{section.index}</span>
          <div>
            <p className="stage-eyebrow">{section.eyebrow}</p>
            <h1 id={`${section.id}-title`}>{section.title}</h1>
            <p>{activeItem.description}</p>
          </div>
        </div>
      )}

      {section.id === 'students' ? (
        <StudentGallery
          items={section.items}
          activeIndex={activeIndex}
          isPlaying={isReelPlaying}
          onActiveIndexChange={(index) => {
            setActiveIndex(index);
          }}
          onSelect={(item, origin) => onOpenDetails(item, section.items, origin)}
        />
      ) : (
        <OrbitGallery
          items={section.items}
          activeIndex={activeIndex}
          onActiveIndexChange={(index) => {
            setActiveIndex(index);
          }}
          onSelect={(item, origin) => onOpenDetails(item, section.items, origin)}
        />
      )}
    </section>
  );
}

