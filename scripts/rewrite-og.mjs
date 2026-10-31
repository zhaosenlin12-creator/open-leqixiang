import { writeFileSync } from "node:fs";

const src = `import { Maximize2, Play } from "lucide-react";
import { useEffect, useMemo, useRef, type PointerEvent } from "react";
import type { ExhibitionItem } from "../data/exhibition";

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

function originFromElement(element: HTMLElement): ExpansionOrigin {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  };
}

export function OrbitGallery({ items, activeIndex, onActiveIndexChange, onSelect }: OrbitGalleryProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState>({
    pointerId: 0,
    lastX: 0,
    accumulated: 0
  });
  const frames = useMemo(() => items.map((item, index) => ({ item, originalIndex: index })), [items]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const active = track.querySelector<HTMLElement>(\`[data-rail-active="true"]\`);
    if (!active) return;
    const targetLeft = active.offsetLeft - track.clientWidth / 2 + active.clientWidth / 2;
    track.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, [activeIndex, items.length]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      accumulated: 0
    };
    event.currentTarget.setPointerCapture(event.pointerId);
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
          return (
            <button
              type="button"
              key={item.id}
              data-rail-active={isActive ? "true" : "false"}
              data-rail-index={originalIndex}
              className={\`orbit-rail-frame \${isActive ? "is-active" : ""}\`}
              onClick={(event) => {
                event.preventDefault();
                const frame = trackRef.current?.querySelector<HTMLElement>(\`[data-rail-index="\${originalIndex}"]\`);
                if (isActive) {
                  onSelect(item, frame ? originFromElement(frame) : undefined);
                  return;
                }
                onActiveIndexChange(originalIndex);
              }}
              aria-label={isActive ? \`放大查看：\${item.title}\` : \`切换到：\${item.title}\`}
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
                    preload="metadata"
                  />
                ) : item.mediaKind === "video" ? (
                  <img src={item.poster ?? item.media} alt="" loading="lazy" decoding="async" />
                ) : (
                  <img
                    src={item.media}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
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
                <b>{String(originalIndex + 1).padStart(2, "0")}</b>
                <span>{item.title}</span>
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
`;

writeFileSync("src/components/OrbitGallery.tsx", src, "utf8");
console.log("wrote", src.length, "bytes");
