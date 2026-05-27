'use client';

/**
 * Read-only SVG overlay on the customer's camera preview. Renders
 * annotations published by the technician. No pointer events.
 */

import type { LensAnnotation } from '@/lib/sablens/transport';

export interface CustomerAnnotationLayerProps {
  annotations: LensAnnotation[];
}

function strokePx(width: number): number {
  return Math.max(0.001, width / 1000);
}

export function CustomerAnnotationLayer({
  annotations,
}: CustomerAnnotationLayerProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full"
    >
      {annotations.map((a) => {
        const sw = strokePx(a.strokeWidth);
        if (a.kind === 'arrow') {
          const [s, e] = a.geometry.points;
          if (!s || !e) return null;
          return (
            <line
              key={a.localId}
              x1={s[0]}
              y1={s[1]}
              x2={e[0]}
              y2={e[1]}
              stroke={a.color}
              strokeWidth={sw}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        if (a.kind === 'rect') {
          const [s, e] = a.geometry.points;
          if (!s || !e) return null;
          const x = Math.min(s[0], e[0]);
          const y = Math.min(s[1], e[1]);
          const w = Math.abs(e[0] - s[0]);
          const h = Math.abs(e[1] - s[1]);
          return (
            <rect
              key={a.localId}
              x={x}
              y={y}
              width={w}
              height={h}
              fill="none"
              stroke={a.color}
              strokeWidth={sw}
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        if (a.kind === 'circle') {
          const [s, e] = a.geometry.points;
          if (!s || !e) return null;
          const r = Math.hypot(e[0] - s[0], e[1] - s[1]);
          return (
            <circle
              key={a.localId}
              cx={s[0]}
              cy={s[1]}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={sw}
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        if (a.kind === 'freehand') {
          const d = a.geometry.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`)
            .join(' ');
          return (
            <path
              key={a.localId}
              d={d}
              fill="none"
              stroke={a.color}
              strokeWidth={sw}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        if (a.kind === 'text') {
          const [p] = a.geometry.points;
          if (!p) return null;
          const size = (a.geometry.size ?? 14) / 1000;
          return (
            <text
              key={a.localId}
              x={p[0]}
              y={p[1]}
              fill={a.color}
              fontSize={size}
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {a.geometry.text ?? ''}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
}
