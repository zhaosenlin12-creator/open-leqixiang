import { Maximize2 } from 'lucide-react';
import { prefetchStudentManifest, prefetchStudentThumbs, preloadStudentImage, resolveStudentThumb, loadThumbsManifest } from '../lib/studentArchive';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { ExhibitionItem } from '../data/exhibition';

export interface ExpansionOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StudentGalleryProps {
  items: ExhibitionItem[];
  activeIndex: number;
  isPlaying: boolean;
  onActiveIndexChange: (index: number) => void;
  onSelect: (item: ExhibitionItem, origin?: ExpansionOrigin) => void;
}

const DRAG_THRESHOLD = 18;
const AUTO_STEP_MS = 2600;

function originFromElement(element: HTMLElement): ExpansionOrigin {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function objectPositionFor(item: ExhibitionItem): string {
  return item.thumbFocus ?? 'center 20%';
}

export function StudentGallery({ items, activeIndex, isPlaying, onActiveIndexChange, onSelect }: StudentGalleryProps) {
  const wallRef = useRef<HTMLDivElement | null>(null);
  const [thumbsReady, setThumbsReady] = useState(false);
  useEffect(() => {
    prefetchStudentManifest();
    prefetchStudentThumbs();
    // loadThumbsManifest resolves from the module-level map. Once it has
    // run, flip a flag so the <img> sources re-resolve through
    // resolveStudentThumb (which reads the real file->thumb map) instead of
    // the heavy originals.
    let alive = true;
    void loadThumbsManifest().then(() => { if (alive) setThumbsReady(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const cur = items[activeIndex];
    if (cur?.media) preloadStudentImage(cur.media); // keep warm for fullscreen click
    const prev = items[(activeIndex - 1 + items.length) % items.length];
    const next = items[(activeIndex + 1) % items.length];
    if (prev?.media) void resolveStudentThumb(prev.media);
    if (next?.media) void resolveStudentThumb(next.media);
  }, [activeIndex, items, thumbsReady]);
  const dragStateRef = useRef({ pointerId: 0, lastY: 0, accumulated: 0 });
  const autoAdvanceRef = useRef<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const currentIndex = hoverIndex ?? activeIndex;
  const resolveThumbFor = (mediaPath: string): string | null => {
    if (!thumbsReady) return null;
    return resolveStudentThumb(mediaPath);
  };
  const frames = useMemo(() => items.map((item, index) => ({ item, index })), [items]);

  useEffect(() => {
    if (autoAdvanceRef.current !== null) {
      window.clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    if (!isPlaying || hoverIndex !== null || items.length <= 1) return;
    autoAdvanceRef.current = window.setTimeout(() => {
      onActiveIndexChange((activeIndex + 1) % items.length);
    }, AUTO_STEP_MS);
    return () => {
      if (autoAdvanceRef.current !== null) {
        window.clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };
  }, [activeIndex, hoverIndex, isPlaying, items.length, onActiveIndexChange]);


  // Auto-scrolls the wall while the gallery is on screen and no card is
  // hovered. The animation is gated by IntersectionObserver: when the wall
  // is off-screen we stop the rAF entirely instead of polling visibility
  // every frame.
  useEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let running = true;
    let raf = 0;
    const step = () => {
      if (!running) return;
      wall.scrollTop += 0.4;
      if (wall.scrollTop + wall.clientHeight >= wall.scrollHeight - 1) {
        wall.scrollTop = 0;
      }
      raf = window.requestAnimationFrame(step);
    };

    if (hoverIndex !== null || !isPlaying || items.length <= 1) {
      return () => { /* idle */ };
    }

    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !running) {
            running = true;
            raf = window.requestAnimationFrame(step);
          } else if (!entry.isIntersecting && running) {
            running = false;
            window.cancelAnimationFrame(raf);
          }
        }
      }, { threshold: 0.01 });
      io.observe(wall);
      raf = window.requestAnimationFrame(step);
      return () => {
        running = false;
        window.cancelAnimationFrame(raf);
        io.disconnect();
      };
    }

    raf = window.requestAnimationFrame(step);
    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
    };
  }, [hoverIndex, isPlaying, items.length]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      lastY: event.clientY,
      accumulated: 0
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (state.pointerId !== event.pointerId) return;
    const delta = event.clientY - state.lastY;
    state.lastY = event.clientY;
    state.accumulated += delta;
    const wall = wallRef.current;
    if (wall) wall.scrollTop -= delta;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (state.pointerId !== event.pointerId) return;
    const totalDelta = state.accumulated;
    dragStateRef.current.pointerId = 0;
    if (Math.abs(totalDelta) > DRAG_THRESHOLD) {
      const direction = totalDelta < 0 ? 1 : -1;
      onActiveIndexChange((activeIndex + direction + items.length) % items.length);
    }
  };

  return (
    <section className="student-gallery" aria-label="学员展示">
      <div className="student-gallery-shell">

<div className="student-wall" ref={wallRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
          {frames.map(({ item, index }) => {
            const isActive = index === activeIndex;
            const isFocused = index === currentIndex;
            return (
              <button
                type="button"
                key={item.id}
                data-student-active={isActive ? 'true' : 'false'}
                data-student-index={index}
                className={`student-card accent-${item.accent} ${isActive ? 'is-active' : ''} ${isFocused ? 'is-focused' : ''}`}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
                onFocus={() => setHoverIndex(index)}
                onBlur={() => setHoverIndex(null)}
                onClick={(event) => {
                  event.preventDefault();
                  if (activeIndex !== index) {
                    onActiveIndexChange(index);
                  }
                  const frame = wallRef.current?.querySelector<HTMLElement>(`[data-student-index="${index}"]`);
                  onSelect(item, frame ? originFromElement(frame) : undefined);
                }}
                aria-label={isActive ? `放大查看：${item.title}` : `切换到：${item.title}`}
              >
                <span className="student-card-media">
                  <img
                    src={resolveThumbFor(item.media) ?? item.media}
                    data-full={item.media}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      // Thumb path can 404 (manifest stale, build skipped
                      // for this asset). Swap to the original on a single
                      // retry, then hide the element on a second failure
                      // so the rest of the gallery stays usable.
                      const img = e.currentTarget;
                      const fullSrc = img.getAttribute("data-full");
                      if (fullSrc && img.src !== fullSrc) {
                        img.src = fullSrc;
                        img.setAttribute("data-retry", "1");
                      } else {
                        img.style.visibility = "hidden";
                      }
                    }}
                    style={{ objectPosition: objectPositionFor(item) }}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
