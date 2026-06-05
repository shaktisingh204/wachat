'use client';

/**
 * 20ui — Branded loaders.
 *
 * `WaterLoader` is the tasteful SabNode brand loader: the wordmark is drawn
 * twice over one SVG. An "empty" outline layer shows the resting glyphs; a
 * "filled" layer is clipped against a rising wave (two scrolling sine paths)
 * so the brand gradient appears to pour up into the letters and ebb back out.
 *
 * `WaterLoaderScreen` centres that loader full-screen for route transitions
 * (App Router `loading.tsx` files, suspense boundaries, page-level waits).
 *
 * Motion (emil-design-eng): pure transform/opacity (GPU-only) — the wave rect
 * translateY's, the two ripple paths translateX. No layout, no canvas, no JS
 * animation loop. Under `prefers-reduced-motion: reduce` the wave parks at a
 * comfortable fill level and only a gentle opacity breathe remains.
 *
 * Accessibility (fixing-accessibility): the root is `role="status"` +
 * `aria-busy="true"` + `aria-live="polite"` with an accessible label; the SVG
 * and decorative halo are `aria-hidden`; a visually-hidden line restates the
 * status for screen readers.
 */

import * as React from 'react';

import './loaders.css';

/* ------------------------------------------------------------------ */
/* WaterLoader                                                         */
/* ------------------------------------------------------------------ */

export interface WaterLoaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'aria-label' | 'role'> {
  /** Pixel width of the loader. Height derives from a ~3.1:1 aspect ratio. */
  width?: number;
  /** Caption rendered beneath the wordmark. Pass `null` to hide it. */
  caption?: React.ReactNode;
  /** Hide the soft brand halo behind the wordmark. */
  flat?: boolean;
  /**
   * Accessible status announced to assistive tech.
   * Visible `caption` is decorative; this is the real label.
   */
  label?: string;
}

/** Unique-per-instance ids so multiple loaders never share SVG defs. */
let loaderSeq = 0;

/** The tasteful SabNode brand loader — a filling/rippling wordmark. */
export function WaterLoader({
  width = 320,
  caption = 'Loading',
  flat = false,
  label = 'Loading',
  className,
  style,
  ...rest
}: WaterLoaderProps): React.JSX.Element {
  // Stable, collision-free ids for this instance's <defs>.
  const uid = React.useMemo(() => `u-water-${(loaderSeq += 1)}`, []);
  const fillId = `${uid}-fill`;
  const emptyId = `${uid}-empty`;
  const clipId = `${uid}-clip`;
  const textId = `${uid}-text`;

  const height = Math.round(width * 0.32);

  return (
    <div
      className={['u-water', flat && 'u-water--flat', className]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      style={{ width, ...style }}
      {...rest}
    >
      {!flat ? <span className="u-water__halo" aria-hidden="true" /> : null}

      <svg
        className="u-water__svg"
        viewBox="0 0 400 128"
        width={width}
        height={height}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* Brand gradient that fills the "water" (amber to orange to rose). */}
          <linearGradient id={fillId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--u-brand-amber)" />
            <stop offset="50%" stopColor="var(--u-brand-orange)" />
            <stop offset="100%" stopColor="var(--u-brand-rose)" />
          </linearGradient>

          {/* Subtle vertical wash for the empty/outline wordmark. */}
          <linearGradient id={emptyId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--st-border-strong)" />
            <stop offset="100%" stopColor="var(--st-text-tertiary)" />
          </linearGradient>

          {/*
            The clip is a wide rect whose TOP edge is shaped by two overlapping
            sine paths. The wrapping <g> translateY's up to fill the wordmark,
            holds, then slides back down to empty — looping forever.
          */}
          <clipPath id={clipId}>
            <g className="u-water__rise">
              <path
                className="u-water__wave u-water__wave--back"
                d="M -200 80 Q -150 60, -100 80 T 0 80 T 100 80 T 200 80 T 300 80 T 400 80 T 500 80 T 600 80 V 200 H -200 Z"
              />
              <path
                className="u-water__wave u-water__wave--front"
                d="M -200 80 Q -150 100, -100 80 T 0 80 T 100 80 T 200 80 T 300 80 T 400 80 T 500 80 T 600 80 V 200 H -200 Z"
              />
            </g>
          </clipPath>

          {/* The wordmark, defined once and instanced twice. */}
          <text
            id={textId}
            x="200"
            y="86"
            textAnchor="middle"
            fontSize="76"
            fontWeight="800"
            fontFamily="var(--st-font)"
            letterSpacing="-2"
          >
            SabNode
          </text>
        </defs>

        {/* Empty/outline layer — visible where the water has not yet reached. */}
        <use
          href={`#${textId}`}
          className="u-water__glyph-empty"
          fill={`url(#${emptyId})`}
        />

        {/* Filled layer — clipped to the rising/falling water shape. */}
        <g clipPath={`url(#${clipId})`}>
          <use href={`#${textId}`} fill={`url(#${fillId})`} />
          {/* Specular highlight that rides the front wave's surface. */}
          <path
            className="u-water__wave u-water__wave--front u-water__crest"
            d="M -200 80 Q -150 100, -100 80 T 0 80 T 100 80 T 200 80 T 300 80 T 400 80 T 500 80 T 600 80"
            fill="none"
          />
        </g>
      </svg>

      {caption != null ? (
        <span className="u-water__caption" aria-hidden="true">
          {caption}
        </span>
      ) : null}

      <span className="u-sr-only">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* WaterLoaderScreen                                                   */
/* ------------------------------------------------------------------ */

export interface WaterLoaderScreenProps
  extends Omit<WaterLoaderProps, 'flat'> {
  /** Render in flow (fills its positioned parent) instead of fixed-viewport. */
  inline?: boolean;
}

/** A full-screen, centred `WaterLoader` for route/suspense transitions. */
export function WaterLoaderScreen({
  caption = 'Loading',
  label = 'Loading',
  inline = false,
  width = 320,
  className,
  ...rest
}: WaterLoaderScreenProps): React.JSX.Element {
  return (
    <div
      className={[
        'u-water-screen',
        inline && 'u-water-screen--inline',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <WaterLoader
        width={width}
        caption={caption}
        label={label}
        flat
        {...rest}
      />
    </div>
  );
}

export default WaterLoader;
