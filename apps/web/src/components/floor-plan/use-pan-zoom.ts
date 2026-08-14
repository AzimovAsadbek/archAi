'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

/** SVG viewBox rectangle, in metres of footprint space. */
export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UserPoint {
  x: number;
  y: number;
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;

/** One button press. */
const BUTTON_STEP = 1.4;
/** Wheel sensitivity — one notch (~100 deltaY) lands near BUTTON_STEP. */
const WHEEL_SENSITIVITY = 0.0035;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Screen pixels per metre for a viewBox rendered with `xMidYMid meet`. */
function scaleFor(view: ViewBox, width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0;
  return Math.min(width / view.width, height / view.height);
}

/** Keeps the view centre inside the drawing, so the plan can never be lost. */
function normalize(view: ViewBox, base: ViewBox): ViewBox {
  const centerX = clamp(view.x + view.width / 2, base.x, base.x + base.width);
  const centerY = clamp(view.y + view.height / 2, base.y, base.y + base.height);
  return {
    x: centerX - view.width / 2,
    y: centerY - view.height / 2,
    width: view.width,
    height: view.height,
  };
}

/** Rescales `view` by `factor`, holding the user-space point `anchor` still. */
function zoomAround(view: ViewBox, base: ViewBox, factor: number, anchor: UserPoint): ViewBox {
  const current = base.width / view.width;
  const next = clamp(current * factor, MIN_ZOOM, MAX_ZOOM);
  if (Math.abs(next - current) < 1e-6) return view;

  const width = base.width / next;
  const height = base.height / next;
  const ratioX = (anchor.x - view.x) / view.width;
  const ratioY = (anchor.y - view.y) / view.height;
  return normalize(
    { x: anchor.x - ratioX * width, y: anchor.y - ratioY * height, width, height },
    base,
  );
}

/** Maps a client point onto footprint metres for the current view. */
function toUserPoint(view: ViewBox, rect: DOMRect, clientX: number, clientY: number): UserPoint {
  const scale = scaleFor(view, rect.width, rect.height);
  if (scale === 0) return { x: view.x + view.width / 2, y: view.y + view.height / 2 };
  const offsetX = (rect.width - view.width * scale) / 2;
  const offsetY = (rect.height - view.height * scale) / 2;
  return {
    x: view.x + (clientX - rect.left - offsetX) / scale,
    y: view.y + (clientY - rect.top - offsetY) / scale,
  };
}

export interface PanZoom {
  svgRef: RefObject<SVGSVGElement | null>;
  view: ViewBox;
  /** 1 = the whole drawing fits the frame. */
  zoom: number;
  /** Measured screen pixels per metre — annotation and label sizing use it. */
  pxPerM: number;
  panning: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerEnd: (event: ReactPointerEvent<SVGSVGElement>) => void;
}

/**
 * viewBox-driven pan + zoom. Everything scales through the viewBox, so the
 * drawing itself never needs pixel maths; `pxPerM` exists only so labels and
 * annotations can keep a constant on-screen size.
 */
export function usePanZoom(widthM: number, lengthM: number, marginM: number): PanZoom {
  const base = useMemo<ViewBox>(
    () => ({
      x: -marginM,
      y: -marginM,
      width: widthM + marginM * 2,
      height: lengthM + marginM * 2,
    }),
    [widthM, lengthM, marginM],
  );

  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ pointerId: number; clientX: number; clientY: number } | null>(null);
  const [view, setView] = useState<ViewBox>(base);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [panning, setPanning] = useState(false);

  // A different house footprint is a different drawing — start from the top.
  useEffect(() => {
    setView(base);
  }, [base]);

  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ width: box.width, height: box.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // React registers `wheel` passively at the root, so the listener that has to
  // call preventDefault (page must not scroll while zooming) is attached here.
  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * WHEEL_SENSITIVITY);
      setView((current) =>
        zoomAround(current, base, factor, toUserPoint(current, rect, event.clientX, event.clientY)),
      );
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [base]);

  const zoomByButton = useCallback(
    (factor: number) => {
      setView((current) =>
        zoomAround(current, base, factor, {
          x: current.x + current.width / 2,
          y: current.y + current.height / 2,
        }),
      );
    },
    [base],
  );

  const onPointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    setPanning(true);
    // Capture keeps the drag alive past the SVG edge; the drag still works if
    // the browser refuses it, so a failure must not abort the gesture.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* no capture available — pointermove on the element still pans */
    }
  }, []);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const state = drag.current;
      if (!state || state.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - state.clientX;
      const deltaY = event.clientY - state.clientY;
      drag.current = { pointerId: state.pointerId, clientX: event.clientX, clientY: event.clientY };

      const rect = event.currentTarget.getBoundingClientRect();
      setView((current) => {
        const scale = scaleFor(current, rect.width, rect.height);
        if (scale === 0) return current;
        return normalize(
          { ...current, x: current.x - deltaX / scale, y: current.y - deltaY / scale },
          base,
        );
      });
    },
    [base],
  );

  const onPointerEnd = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setPanning(false);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* nothing to release */
    }
  }, []);

  return {
    svgRef,
    view,
    zoom: base.width / view.width,
    pxPerM: scaleFor(view, size.width, size.height),
    panning,
    zoomIn: useCallback(() => zoomByButton(BUTTON_STEP), [zoomByButton]),
    zoomOut: useCallback(() => zoomByButton(1 / BUTTON_STEP), [zoomByButton]),
    reset: useCallback(() => setView(base), [base]),
    onPointerDown,
    onPointerMove,
    onPointerEnd,
  };
}
