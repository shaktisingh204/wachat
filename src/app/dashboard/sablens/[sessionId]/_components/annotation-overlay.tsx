'use client';

/**
 * SVG overlay for spatial annotations.
 *
 * Coordinate system is normalized `0..1` so the same annotation
 * re-projects across any aspect ratio. The overlay measures its own
 * bounding rect, converts pointer events to normalized space, and emits
 * completed strokes via `onCommit`. Live in-flight strokes are local
 * state, the parent only learns about a stroke when the pointer is
 * released.
 *
 * Five tools are wired:
 *   - arrow:    two-point line with arrowhead
 *   - rect:     drag-rectangle
 *   - circle:   drag-radius circle (start = centre)
 *   - freehand: captures every pointer-move
 *   - text:     single click + prompt() label (kept synchronous so the
 *               stroke stays in this component's local state until the
 *               user finalises the label)
 */

import { useCallback, useRef, useState } from 'react';

import type {
  LensAnnotation,
  LensAnnotationGeometry,
  LensAnnotationKind,
} from '@/lib/sablens/transport';

export interface AnnotationOverlayProps {
  annotations: LensAnnotation[];
  /** Active tool. `null` disables drawing (cursor mode). */
  tool: LensAnnotationKind | null;
  color: string;
  strokeWidth: number;
  onCommit: (a: Omit<LensAnnotation, 'localId' | 'ts'>) => void;
  sessionId: string;
}

type ActiveStroke =
  | { kind: 'arrow' | 'rect' | 'circle'; start: [number, number]; end: [number, number] }
  | { kind: 'freehand'; points: [number, number][] };

export function AnnotationOverlay({
  annotations,
  tool,
  color,
  strokeWidth,
  onCommit,
  sessionId,
}: AnnotationOverlayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [active, setActive] = useState<ActiveStroke | null>(null);

  const toNorm = useCallback((e: React.PointerEvent): [number, number] => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    ];
  }, []);

  function commit(geometry: LensAnnotationGeometry, kind: LensAnnotationKind) {
    onCommit({
      sessionId,
      kind,
      geometry,
      color,
      strokeWidth,
      persistent: true,
      authorKind: 'user',
    });
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!tool) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toNorm(e);
    if (tool === 'text') {
      const label = typeof window !== 'undefined'
        ? window.prompt('Annotation text')
        : null;
      if (label) {
        commit({ points: [p], text: label, size: 14 }, 'text');
      }
      return;
    }
    if (tool === 'freehand') {
      setActive({ kind: 'freehand', points: [p] });
    } else {
      setActive({ kind: tool, start: p, end: p });
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!active) return;
    const p = toNorm(e);
    if (active.kind === 'freehand') {
      setActive({ kind: 'freehand', points: [...active.points, p] });
    } else {
      setActive({ ...active, end: p });
    }
  }

  function handlePointerUp() {
    if (!active) return;
    if (active.kind === 'freehand') {
      if (active.points.length > 1) {
        commit({ points: active.points }, 'freehand');
      }
    } else {
      commit({ points: [active.start, active.end] }, active.kind);
    }
    setActive(null);
  }

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label="SabLens annotation overlay"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className={`absolute inset-0 size-full select-none touch-none ${tool ? 'cursor-crosshair' : 'cursor-default'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {annotations.map((a) => (
        <RenderAnnotation key={a.localId} annotation={a} />
      ))}
      {active && (
        <RenderActive stroke={active} color={color} strokeWidth={strokeWidth} />
      )}
    </svg>
  );
}

function strokePx(width: number): number {
  // The viewBox is 0..1, convert px to "normalized stroke" by dividing
  // by ~1000 (renders crisply across typical viewport widths).
  return Math.max(0.001, width / 1000);
}

function RenderAnnotation({ annotation }: { annotation: LensAnnotation }) {
  const { kind, geometry, color, strokeWidth } = annotation;
  const sw = strokePx(strokeWidth);
  if (kind === 'arrow') {
    const [a, b] = geometry.points;
    if (!a || !b) return null;
    return <Arrow a={a} b={b} color={color} sw={sw} />;
  }
  if (kind === 'rect') {
    const [a, b] = geometry.points;
    if (!a || !b) return null;
    const x = Math.min(a[0], b[0]);
    const y = Math.min(a[1], b[1]);
    const w = Math.abs(b[0] - a[0]);
    const h = Math.abs(b[1] - a[1]);
    return (
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  if (kind === 'circle') {
    const [a, b] = geometry.points;
    if (!a || !b) return null;
    const r = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return (
      <circle
        cx={a[0]}
        cy={a[1]}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  if (kind === 'freehand') {
    const d = geometry.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`)
      .join(' ');
    return (
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  if (kind === 'text') {
    const [p] = geometry.points;
    if (!p) return null;
    const size = (geometry.size ?? 14) / 1000;
    return (
      <text
        x={p[0]}
        y={p[1]}
        fill={color}
        fontSize={size}
        fontFamily="system-ui, sans-serif"
      >
        {geometry.text ?? ''}
      </text>
    );
  }
  return null;
}

function RenderActive({
  stroke,
  color,
  strokeWidth,
}: {
  stroke: ActiveStroke;
  color: string;
  strokeWidth: number;
}) {
  const sw = strokePx(strokeWidth);
  if (stroke.kind === 'freehand') {
    const d = stroke.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`)
      .join(' ');
    return (
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.85}
      />
    );
  }
  if (stroke.kind === 'arrow') {
    return <Arrow a={stroke.start} b={stroke.end} color={color} sw={sw} />;
  }
  if (stroke.kind === 'rect') {
    const x = Math.min(stroke.start[0], stroke.end[0]);
    const y = Math.min(stroke.start[1], stroke.end[1]);
    const w = Math.abs(stroke.end[0] - stroke.start[0]);
    const h = Math.abs(stroke.end[1] - stroke.start[1]);
    return (
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        vectorEffect="non-scaling-stroke"
        opacity={0.85}
      />
    );
  }
  // circle
  const r = Math.hypot(stroke.end[0] - stroke.start[0], stroke.end[1] - stroke.start[1]);
  return (
    <circle
      cx={stroke.start[0]}
      cy={stroke.start[1]}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={sw}
      vectorEffect="non-scaling-stroke"
      opacity={0.85}
    />
  );
}

function Arrow({
  a,
  b,
  color,
  sw,
}: {
  a: [number, number];
  b: [number, number];
  color: string;
  sw: number;
}) {
  const headSize = Math.max(sw * 6, 0.018);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const perpX = -uy;
  const perpY = ux;
  const tipX = b[0];
  const tipY = b[1];
  const baseX = b[0] - ux * headSize;
  const baseY = b[1] - uy * headSize;
  const leftX = baseX + perpX * headSize * 0.5;
  const leftY = baseY + perpY * headSize * 0.5;
  const rightX = baseX - perpX * headSize * 0.5;
  const rightY = baseY - perpY * headSize * 0.5;
  return (
    <>
      <line
        x1={a[0]}
        y1={a[1]}
        x2={baseX}
        y2={baseY}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
        fill={color}
      />
    </>
  );
}
