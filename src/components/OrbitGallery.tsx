import { Maximize2, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { ExhibitionItem } from "../data/exhibition";
import { prefetchSectionThumbs, resolveSectionThumb } from "../lib/studentArchive";

export interface ExpansionOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OrbitGalleryProps {
  items: ExhibitionItem[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (item: ExhibitionItem, origin?: ExpansionOrigin) => void;
}

interface DragState {
  pointerId: number;
  lastX: number;
  accumulated: number;
}

const DRAG_THRESHOLD = 28;
const THUMB_TIMEOUT_MS = 1000; // lowered from 2000: weak networks choke on 9MB videos
const THUMB_WIDTH = 240;
const THUMB_LUMA_THRESHOLD = 18;


function originFromElement(element: HTMLElement): ExpansionOrigin {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

// Module-level cache. Survives remounts so re-visiting a section never
// re-fetches the same metadata.
const thumbnailCache = new Map<string, string>();

function extractFirstFrame(src: string): Promise<string | null> {
  if (thumbnailCache.has(src)) return Promise.resolve(thumbnailCache.get(src)!);
  if (typeof document === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    let timer: number | undefined;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    // 320x180 keeps headless Chromium honest about decoding the stream.
    video.style.position = "fixed";
    video.style.left = "-10000px";
    video.style.top = "0";
    video.style.width = "320px";
    video.style.height = "180px";
    video.style.pointerEvents = "none";
    document.body.appendChild(video);
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      try { video.pause(); } catch { /* ignore */ }
      video.removeAttribute("src");
      try { video.load(); } catch { /* ignore */ }
      if (video.parentNode) video.parentNode.removeChild(video);
      if (value) thumbnailCache.set(src, value);
      resolve(value);
    };
    timer = window.setTimeout(() => finish(null), THUMB_TIMEOUT_MS);

    // Some headless Chromium builds report videoWidth/videoHeight as 0 even
    // when the video is fully decoded. Use the element's rendered size as a
    // fallback so drawImage still produces a real bitmap.
    const sourceSize = (): { w: number; h: number } => {
      const w = video.videoWidth || video.clientWidth || 320;
      const h = video.videoHeight || video.clientHeight || Math.round((w * 9) / 16);
      return { w, h };
    };

    const buildCanvas = (): { canvas: HTMLCanvasElement; luma: number } | { err: string } => {
      try {
        const thumbW = THUMB_WIDTH;
        const { w: srcW, h: srcH } = sourceSize();
        const thumbH = Math.max(1, Math.round((thumbW * srcH) / Math.max(1, srcW)));
        const canvas = document.createElement("canvas");
        canvas.width = thumbW;
        canvas.height = thumbH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return { err: "no-ctx" };
        ctx.drawImage(video, 0, 0, srcW, srcH, 0, 0, thumbW, thumbH);
        const data = ctx.getImageData(0, 0, thumbW, thumbH).data;
        let total = 0;
        let samples = 0;
        for (let i = 0; i < data.length; i += 32) {
          total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          samples++;
        }
        return { canvas, luma: samples > 0 ? total / samples : 0 };
      } catch (err) {
        return { err: String(err) };
      }
    };

    // Sample several points in the timeline and grab the first non-dark one.
    const seekTargets = (duration: number) => {
      if (!Number.isFinite(duration) || duration <= 0) return [1, 3, 5, 8];
      return [
        Math.max(0.5, Math.min(duration * 0.2, duration - 0.5)),
        Math.max(0.5, Math.min(duration * 0.4, duration - 0.5)),
        Math.max(0.5, Math.min(duration * 0.6, duration - 0.5)),
        Math.max(0.5, Math.min(duration * 0.8, duration - 0.5))
      ];
    };
    let targetIdx = 0;
    let attempts = 0;
    const startTime = Date.now();

        const tryCapture = () => {
      if (Date.now() - startTime > THUMB_TIMEOUT_MS - 200) { finish(null); return; }
      attempts++;
      if (attempts > 6) { finish(null); return; }
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 5;
      const targets = seekTargets(duration);
      const t = targets[Math.min(targetIdx, targets.length - 1)];
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        video.muted = true;
        const playPromise = video.play();
        if (!playPromise) { tryNext(); return; }
        playPromise.then(
          () => {
            window.setTimeout(() => {
              try {
                video.pause();
                const result = buildCanvas();
                if ("err" in result || result.luma < THUMB_LUMA_THRESHOLD) {
                  targetIdx++;
                  tryCapture();
                  return;
                }
                finish(result.canvas.toDataURL("image/jpeg", 0.72));
              } catch {
                targetIdx++;
                tryCapture();
              }
            }, 350);
          },
          () => {
            targetIdx++;
            tryCapture();
          }
        );
      };
      video.addEventListener("seeked", onSeeked);
      try { video.currentTime = t; } catch { finish(null); }
    };

    const tryNext = () => {
      targetIdx++;
      tryCapture();
    };

    const onLoaded = () => {
      video.removeEventListener("loadeddata", onLoaded);
      tryCapture();
    };
    if (video.readyState >= 2) onLoaded();
    else video.addEventListener("loadeddata", onLoaded, { once: true });
    video.src = src;
    video.load();
  });
}

export function OrbitGallery({ items, activeIndex, onActiveIndexChange, onSelect }: OrbitGalleryProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState>({ pointerId: 0, lastX: 0, accumulated: 0 });
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(() => new Map(thumbnailCache));
  const frames = useMemo(() => items.map((item, index) => ({ item, originalIndex: index })), [items]);

  // Center the active card whenever it changes.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const active = track.querySelector<HTMLElement>(`[data-rail-active="true"]`);
    if (!active) return;
    active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIndex, items.length]);

  // Extract first-frame thumbnails for any video item that has no poster
  // and isn\'t already cached. Once the dataURL is ready we swap the
  // inactive-card <video preload="none"> (which is what produced the black
  // tiles in the showreel) for a static <img>.
  useEffect(() => {
    let cancelled = false;
    const targets: string[] = [];
    for (const { item } of frames) {
      if (item.mediaKind !== "video") continue;
      if (item.poster) continue;
      if (thumbnailCache.has(item.media)) continue;
      targets.push(item.media);
    }
    if (targets.length === 0) return;
    (async () => {
      for (const src of targets) {
        const dataUrl = await extractFirstFrame(src);
        if (cancelled || !dataUrl) continue;
        setThumbnails((prev) => {
          if (prev.get(src) === dataUrl) return prev;
          const next = new Map(prev);
          next.set(src, dataUrl);
          return next;
        });
      }
    })();
  }, [frames]);

  useEffect(() => { prefetchSectionThumbs(); }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      accumulated: 0
    };
    // setPointerCapture can throw NotFoundError when the pointer is no longer
    // active (e.g. synthetic clicks in headless browsers, or touch+stylus
    // events where the system has already released the pointer). Swallow the
    // error so the drag tracking state above is still set up.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore — drag still works on pointermove/pointerup */
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (state.pointerId !== event.pointerId) return;
    const step = event.clientX - state.lastX;
    state.lastX = event.clientX;
    state.accumulated += step;
    const track = trackRef.current;
    if (track && Math.abs(state.accumulated) > 8) track.scrollLeft -= step;
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

  // Stable per-item click handlers.
  const clickHandlers = useMemo(() => {
    const map = new Map<string, (event: React.MouseEvent<HTMLButtonElement>) => void>();
    for (const { item, originalIndex } of frames) {
      const isActive = originalIndex === activeIndex;
      map.set(item.id, (event) => {
        event.preventDefault();
        if (isActive) {
          const frame = trackRef.current?.querySelector<HTMLElement>(`[data-rail-index="${originalIndex}"]`);
          onSelect(item, frame ? originFromElement(frame) : undefined);
          return;
        }
        onActiveIndexChange(originalIndex);
      });
    }
    return map;
  }, [frames, activeIndex, onActiveIndexChange, onSelect]);

  return (
    <div className="orbit-rail" aria-label="内容索引">
      <div
        ref={trackRef}
        className="orbit-rail-track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {frames.map(({ item, originalIndex }) => {
          const isActive = originalIndex === activeIndex;
          const thumbnail = item.mediaKind === "video"
            ? (thumbnails.get(item.media) ?? item.poster ?? resolveSectionThumb(item.media))
            : undefined;
          return (
            <button
              type="button"
              key={item.id}
              data-rail-active={isActive ? "true" : "false"}
              data-rail-index={originalIndex}
              data-rail-accent={item.accent}
              data-rail-family={item.eyebrow}
              className={`orbit-rail-frame accent-${item.accent} ${isActive ? "is-active" : ""}`}
              onClick={clickHandlers.get(item.id)}
              aria-label={isActive ? `放大查看：${item.title}` : `切换到：${item.title}`}
            >
              <span className="orbit-rail-media">
                {isActive && item.mediaKind === "video" ? (
                  <video
                    src={item.media}
                    poster={item.poster}
                    muted
                    autoPlay
                    loop
                    playsInline
                    preload="none"
                  />
                ) : item.mediaKind === "video" ? (
                  thumbnail ? (
                    <img src={thumbnail} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  ) : (
                    <span className="orbit-rail-placeholder" aria-hidden="true" style={item.poster ? { backgroundImage: 'url(' + item.poster + ')' } : undefined} />
                  )
                ) : (
                  <img
                    src={resolveSectionThumb(item.media) ?? item.media}
                    data-full={item.media}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const img = e.currentTarget;
                      const fullSrc = img.getAttribute("data-full");
                      if (fullSrc && img.src.endsWith(img.getAttribute("data-thumb") ?? "__none__")) {
                        img.src = fullSrc;
                      } else {
                        img.style.visibility = "hidden";
                      }
                    }}
                    className={item.fit === "contain" ? "fit-contain" : ""}
                  />
                )}
                {item.mediaKind === "video" && (
                  <span className="orbit-rail-mark" aria-hidden="true">
                    <Play size={12} />
                  </span>
                )}
              </span>
              <span className="orbit-rail-meta">
                <b className={`orbit-rail-meta-index accent-${item.accent}`}>{String(originalIndex + 1).padStart(2, "0")}</b>
                <span className="orbit-rail-meta-title">{item.title}</span>
              </span>
              {isActive && (
                <span className="orbit-rail-expand" aria-hidden="true">
                  <Maximize2 size={14} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
