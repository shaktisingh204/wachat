'use client';

/**
 * 20ui — Skeleton, Spinner, Progress, ProgressRing.
 *
 * Loading primitives, three flavours of "wait":
 *  - Skeleton — a shimmer placeholder that mimics the SHAPE of the final
 *    content (a line, a block, a circle). Not a spinner; it reassures by
 *    matching the layout that is about to appear. Animates a gradient's
 *    background-position (compositor-friendly).
 *  - Spinner — a rotating ring (border trick) for indeterminate, in-place
 *    waits. Icon-only, so it carries an `aria-label`.
 *  - Progress — a linear determinate bar (`role="progressbar"` +
 *    `aria-valuenow/min/max`) with tones and an indeterminate mode, plus a
 *    circular `ProgressRing` variant (SVG `stroke-dashoffset`).
 *
 * Reduced motion: the global layer + the local @media block slow/stop the
 * shimmer, spin, and indeterminate sweeps so nothing moves unexpectedly.
 */

import * as React from 'react';

import './loading.css';

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

export interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** CSS width (number → px). Defaults to 100%. */
  width?: number | string;
  /** CSS height (number → px). Defaults to a single text line. */
  height?: number | string;
  /** Corner radius (number → px). Ignored when `circle`. */
  radius?: number | string;
  /** Render a perfect circle (avatars). Uses `width` for both axes. */
  circle?: boolean;
}

const toLen = (v: number | string | undefined): string | undefined =>
  v == null ? undefined : typeof v === 'number' ? `${v}px` : v;

/** A shimmer placeholder shaped like the content it stands in for. */
export function Skeleton({
  width,
  height,
  radius,
  circle = false,
  className,
  style,
  ...rest
}: SkeletonProps): React.JSX.Element {
  const w = toLen(width);
  const h = toLen(height);
  const mergedStyle: React.CSSProperties = {
    width: circle ? (w ?? '2.25rem') : w,
    height: circle ? (w ?? '2.25rem') : h,
    borderRadius: circle ? '50%' : toLen(radius),
    ...style,
  };
  return (
    <span
      className={['u-skeleton', circle && 'u-skeleton--circle', className]
        .filter(Boolean)
        .join(' ')}
      style={mergedStyle}
      aria-hidden="true"
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Spinner                                                             */
/* ------------------------------------------------------------------ */

export type SpinnerSize = 'sm' | 'md' | 'lg' | number;

export interface SpinnerProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'aria-label'> {
  /** Preset (`sm`/`md`/`lg`) or an explicit pixel diameter. */
  size?: SpinnerSize;
  /** Accessible name announced to AT. */
  label?: string;
}

const SPINNER_PX: Record<'sm' | 'md' | 'lg', number> = { sm: 14, md: 18, lg: 28 };

/** A rotating ring for indeterminate, in-place waits. */
export function Spinner({
  size = 'md',
  label = 'Loading',
  className,
  style,
  ...rest
}: SpinnerProps): React.JSX.Element {
  const px = typeof size === 'number' ? size : SPINNER_PX[size];
  const stroke = Math.max(2, Math.round(px / 9));
  return (
    <span
      className={['u-spinner', className].filter(Boolean).join(' ')}
      role="status"
      aria-label={label}
      style={
        {
          '--u-spinner-size': `${px}px`,
          '--u-spinner-stroke': `${stroke}px`,
          ...style,
        } as React.CSSProperties
      }
      {...rest}
    >
      <span className="u-spinner__ring" aria-hidden="true" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Progress (linear)                                                   */
/* ------------------------------------------------------------------ */

export type ProgressTone = 'accent' | 'success' | 'warning' | 'danger';
export type ProgressSize = 'sm' | 'md' | 'lg';

export interface ProgressProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'role'> {
  /** Filled amount, 0–100. Ignored while `indeterminate`. */
  value?: number;
  tone?: ProgressTone;
  size?: ProgressSize;
  /** Unknown progress — runs an indeterminate sweep instead of a fill. */
  indeterminate?: boolean;
  /** Accessible name for the bar (defaults to "Progress"). */
  label?: string;
}

const clamp = (n: number): number => (n < 0 ? 0 : n > 100 ? 100 : n);

/** A linear determinate (or indeterminate) progress bar. */
export function Progress({
  value = 0,
  tone = 'accent',
  size = 'md',
  indeterminate = false,
  label = 'Progress',
  className,
  ...rest
}: ProgressProps): React.JSX.Element {
  const pct = clamp(value);
  const cls = [
    'u-progress',
    `u-progress--${tone}`,
    `u-progress--${size}`,
    indeterminate && 'is-indeterminate',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      {...rest}
    >
      <span
        className="u-progress__fill"
        style={indeterminate ? undefined : { transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ProgressRing (circular)                                             */
/* ------------------------------------------------------------------ */

export interface ProgressRingProps
  extends Omit<React.SVGProps<SVGSVGElement>, 'role'> {
  /** Filled amount, 0–100. Ignored while `indeterminate`. */
  value?: number;
  tone?: ProgressTone;
  /** Outer diameter in px. */
  size?: number;
  /** Ring thickness in px. */
  thickness?: number;
  /** Unknown progress — spins a partial arc. */
  indeterminate?: boolean;
  /** Render the percent in the centre (determinate only). */
  showValue?: boolean;
  /** Accessible name for the ring. */
  label?: string;
}

/** A circular progress ring driven by SVG `stroke-dashoffset`. */
export function ProgressRing({
  value = 0,
  tone = 'accent',
  size = 44,
  thickness = 4,
  indeterminate = false,
  showValue = false,
  label = 'Progress',
  className,
  ...rest
}: ProgressRingProps): React.JSX.Element {
  const pct = clamp(value);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const offset = indeterminate ? c * 0.75 : c * (1 - pct / 100);
  const center = size / 2;
  return (
    <svg
      className={[
        'u-ring',
        `u-ring--${tone}`,
        indeterminate && 'is-indeterminate',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      {...rest}
    >
      <circle
        className="u-ring__track"
        cx={center}
        cy={center}
        r={r}
        fill="none"
        strokeWidth={thickness}
      />
      <circle
        className="u-ring__indicator"
        cx={center}
        cy={center}
        r={r}
        fill="none"
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
      />
      {showValue && !indeterminate ? (
        <text
          className="u-ring__value"
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {Math.round(pct)}%
        </text>
      ) : null}
    </svg>
  );
}

export default Skeleton;
