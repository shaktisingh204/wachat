'use client';

/**
 * 20ui · charts — Sparkline.
 *
 * A tiny inline trend glyph (pure SVG — no recharts overhead for something
 * this small). Quiet by design: a single line plus a faint area fill, no
 * axes, no grid, no labels. Drop it next to a KPI value or inside a table
 * cell. Decorative by default (`aria-hidden`); pass `aria-label` to make it
 * an accessible image.
 */

import * as React from 'react';

import './charts.css';

export interface SparklineProps
  extends Omit<React.SVGProps<SVGSVGElement>, 'data' | 'width' | 'height'> {
  /** Ordered numeric series (oldest → newest). */
  data: ReadonlyArray<number>;
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** Line color (CSS value). Defaults to the current text token. */
  stroke?: string;
  /** Render the faint area fill under the line. */
  fillArea?: boolean;
}

/** A compact inline trend line. Renders nothing for fewer than 2 points. */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  strokeWidth = 1.5,
  stroke = 'var(--st-text)',
  fillArea = true,
  className,
  'aria-label': ariaLabel,
  ...rest
}: SparklineProps): React.JSX.Element | null {
  if (data.length < 2) return null;

  const pad = strokeWidth;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const n = data.length;

  const x = (i: number): number => pad + (i / (n - 1)) * (width - pad * 2);
  const y = (v: number): number =>
    pad + (1 - (v - min) / span) * (height - pad * 2);

  const points = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const areaPoints = `${x(0)},${height - pad} ${points} ${x(n - 1)},${height - pad}`;

  return (
    <svg
      className={['u-chx-spark', className].filter(Boolean).join(' ')}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      focusable="false"
      {...rest}
    >
      {fillArea ? (
        <polygon points={areaPoints} fill={stroke} fillOpacity={0.08} stroke="none" />
      ) : null}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
