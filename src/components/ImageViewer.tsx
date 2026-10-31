import { useCallback, useEffect, useRef, useState, type WheelEvent, type PointerEvent, type MouseEvent } from "react";
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Download } from "lucide-react";

interface ImageViewerProps {
  src: string;
  alt: string;
  fit?: "contain" | "cover";
  onClose?: () => void;
}

// The stage uses native overflow scroll. Scale only changes the rendered image
// size; the browser handles panning, keyboard arrows, and momentum for us.
const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.15;

export function ImageViewer({ src, alt, fit = "contain", onClose }: ImageViewerProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [imgKey, setImgKey] = useState(0);
  const clickGuardRef = useRef({ downX: 0, downY: 0, moved: false });

  // Fit-to-stage scale (contains by default, covers when asked). Only used as the
  // initial size and as the toggle target of the fit button; the user is otherwise
  // free to zoom and scroll past it.
  const fitScale = useCallback(() => {
    const s = stageRef.current;
    if (!s || !naturalSize) return 1;
    const cs = getComputedStyle(s);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const cw = Math.max(1, s.clientWidth - padX);
    const ch = Math.max(1, s.clientHeight - padY);
    if (naturalSize.w <= 0 || naturalSize.h <= 0) return 1;
    return fit === "cover"
      ? Math.max(cw / naturalSize.w, ch / naturalSize.h)
      : Math.min(cw / naturalSize.w, ch / naturalSize.h);
  }, [naturalSize, fit]);

  useEffect(() => { setScale(1); setImgKey((k) => k + 1); }, [src]);
  useEffect(() => { if (naturalSize) setScale(fitScale()); }, [naturalSize, fitScale]);

  // Wheel zoom anchored to the cursor: read its stage-relative position, then
  // shift scrollTop/Left so the same image pixel stays under the cursor after the
  // scale change. requestAnimationFrame waits for the new layout to apply first.
  const applyZoom = useCallback((next: number, clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) { setScale(next); return; }
    const rect = stage.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const ratio = next / scale;
    setScale(next);
    requestAnimationFrame(() => {
      stage.scrollLeft += cx * (ratio - 1);
      stage.scrollTop += cy * (ratio - 1);
    });
  }, [scale]);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const direction = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * direction));
      applyZoom(next, e.clientX, e.clientY);
      return next;
    });
  }, [applyZoom]);

  const zoomBy = useCallback((factor: number) => {
    const stage = stageRef.current; if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
    applyZoom(next, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [scale, applyZoom]);

  const setFit = useCallback(() => {
    const stage = stageRef.current; const fs = fitScale();
    if (!stage) { setScale(fs); return; }
    const rect = stage.getBoundingClientRect();
    applyZoom(fs, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [fitScale, applyZoom]);

  const setNative = useCallback(() => {
    const stage = stageRef.current; if (!stage) return;
    const rect = stage.getBoundingClientRect();
    applyZoom(1, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [applyZoom]);

  // Double-click toggles between fit and 100% natural size, anchored to the cursor.
  const onDoubleClick = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).closest(".image-viewer-toolbar")) return;
    if (scale > fitScale() * 1.02) { setFit(); } else { applyZoom(1, e.clientX, e.clientY); }
  }, [scale, fitScale, setFit, applyZoom]);

  // A tap on the stage (no drag) closes the viewer.
  const onPointerDownStage = useCallback((e: PointerEvent) => {
    if (e.button !== 0) return;
    clickGuardRef.current = { downX: e.clientX, downY: e.clientY, moved: false };
  }, []);
  const onPointerMoveStage = useCallback((e: PointerEvent) => {
    const g = clickGuardRef.current;
    if (!g.moved && Math.abs(e.clientX - g.downX) + Math.abs(e.clientY - g.downY) > 4) g.moved = true;
  }, []);
  const onClickStage = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).closest(".image-viewer-toolbar")) return;
    if (clickGuardRef.current.moved) return;
    onClose?.();
  }, [onClose]);

  const onDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = src;
    a.download = alt || "image";
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [src, alt]);

  const displayW = naturalSize ? Math.max(1, naturalSize.w * scale) : 0;
  const displayH = naturalSize ? Math.max(1, naturalSize.h * scale) : 0;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.addEventListener('wheel', onWheel as unknown as EventListener, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel as unknown as EventListener);
  }, [onWheel]);

  return (
    <div className={["image-viewer", "fit-" + fit].join(" ")}>
      <div className="image-viewer-toolbar" role="toolbar" aria-label="image viewer toolbar" onPointerDown={(e) => e.stopPropagation()}>
        <div className="image-viewer-toolbar-group">
          <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label="zoom out" title="zoom out"><ZoomOut size={18} strokeWidth={1.8} /></button>
          <span className="image-viewer-scale">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => zoomBy(ZOOM_STEP)} aria-label="zoom in" title="zoom in"><ZoomIn size={18} strokeWidth={1.8} /></button>
          <button type="button" onClick={setFit} aria-label="fit to stage" title="fit to stage"><Maximize size={18} strokeWidth={1.8} /></button>
          <button type="button" onClick={setNative} aria-label="100% natural size" title="100% natural size"><RotateCcw size={18} strokeWidth={1.8} /></button>
          <button type="button" onClick={onDownload} aria-label="download original" title="download original"><Download size={18} strokeWidth={1.8} /></button>
        </div>
      </div>
      <div className="image-viewer-stage" ref={stageRef} onPointerDown={onPointerDownStage} onPointerMove={onPointerMoveStage} onClick={onClickStage} onDoubleClick={onDoubleClick}>
        <div className="image-viewer-wrapper" style={{ width: displayW + "px", height: displayH + "px", minWidth: "100%", minHeight: "100%" }}>
          <img key={imgKey} src={src} alt={alt} draggable={false} style={naturalSize ? { width: "100%", height: "100%", display: "block" } : { visibility: "hidden" }} onLoad={(e) => { const el = e.currentTarget; if (el.naturalWidth && el.naturalHeight) setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight }); }} />
        </div>
      </div>
    </div>
  );
}

