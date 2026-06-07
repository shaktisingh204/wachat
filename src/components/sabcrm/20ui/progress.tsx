'use client';

/**
 * 20ui — Progress.
 *
 * A token-skinned wrapper around `@radix-ui/react-progress`. The Radix Root owns
 * the `role="progressbar"` semantics (`aria-valuenow` / `aria-valuemin` /
 * `aria-valuemax` and `data-state` / `data-value`), and the Indicator is the
 * filled bar. 20ui supplies the look: a recessed track on `--st-bg-muted`, a
 * single tone accent for the fill, one radius system, and an Emil-friendly fill
 * that animates via `transform` only.
 *
 * Two modes:
 *   · Determinate — pass `value` (0..100); the fill width tracks it with a
 *     transform transition.
 *   · Indeterminate — set `indeterminate`; Radix drops `aria-valuenow` and the
 *     fill runs a looping shuttle keyframe (disabled under reduced-motion).
 *
 *   <Progress value={64} />
 *   <Progress value={30} tone="warning" size="sm" />
 *   <Progress indeterminate aria-label="Loading records" />
 */

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import './progress.css';

const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/** Tone of the filled bar. Maps to a single status/accent token. */
export type Ui20ProgressTone = 'accent' | 'success' | 'warning' | 'danger';

/** Track height. `sm` is the compact inline rail; `md` is the default. */
export type Ui20ProgressSize = 'sm' | 'md';

export interface Ui20ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** Extra classes for the inner filled indicator. */
  indicatorClassName?: string;
  /**
   * Run the looping shuttle animation instead of tracking `value`. When set,
   * Radix omits `aria-valuenow` so assistive tech announces an undetermined
   * amount. The loop is disabled under `prefers-reduced-motion`.
   */
  indeterminate?: boolean;
  /** Fill colour. Defaults to the one brand accent. */
  tone?: Ui20ProgressTone;
  /** Track thickness. Defaults to `md`. */
  size?: Ui20ProgressSize;
}

/**
 * Determinate or indeterminate progress bar. Forwards its ref to the Radix Root.
 * Clamps `value` into 0..100 for the fill transform; passes the raw Radix
 * `value`/`max` through for correct ARIA semantics.
 */
export const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  Ui20ProgressProps
>(function Progress(
  {
    className,
    value,
    max = 100,
    indicatorClassName,
    indeterminate = false,
    tone = 'accent',
    size = 'md',
    ...rest
  },
  ref,
) {
  // Indeterminate: hand Radix `value={null}` so it drops aria-valuenow and marks
  // the bar as in an indeterminate state. Otherwise clamp for a sane fill width.
  const clamped =
    value == null ? 0 : Math.min(Math.max(value, 0), max);
  const pct = max > 0 ? (clamped / max) * 100 : 0;

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={indeterminate ? null : value}
      max={max}
      data-tone={tone}
      data-size={size}
      data-indeterminate={indeterminate ? '' : undefined}
      className={cx('u-progress', className)}
      {...rest}
    >
      <ProgressPrimitive.Indicator
        className={cx('u-progress__indicator', indicatorClassName)}
        style={
          indeterminate
            ? undefined
            : { transform: `translateX(-${100 - pct}%)` }
        }
      />
    </ProgressPrimitive.Root>
  );
});

export default Progress;
