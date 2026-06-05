'use client';

/**
 * 20ui — Slider.
 *
 * A thin, tasteful range input wrapping `@radix-ui/react-slider`, so the full
 * pointer + keyboard + ARIA model (Arrow steps, Home/End, PageUp/PageDown,
 * `role="slider"`, `aria-valuemin/max/now`, `aria-orientation`) comes for free.
 * Accepts a single value OR a two-value range (two thumbs); the accent-filled
 * range sits between the first and last thumb. Optional tick marks, an optional
 * live value read-out, and a vertical orientation. Tones map to the accent /
 * status / danger / warn token families. Emil polish: the thumb scales on grab
 * and lifts on hover; reduced-motion drops the thumb transition.
 */

import * as React from 'react';
import * as RadixSlider from '@radix-ui/react-slider';

import './slider.css';

export type SliderTone = 'accent' | 'success' | 'warn' | 'danger';

export interface SliderProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof RadixSlider.Root>,
    'value' | 'defaultValue' | 'onValueChange' | 'asChild'
  > {
  /** Controlled value: a single number, or `[lo, hi]` for a two-thumb range. */
  value?: number | number[];
  /** Uncontrolled initial value (same shape as `value`). */
  defaultValue?: number | number[];
  /** Fires with the same shape that was passed in (number vs number[]). */
  onValueChange?: (value: number | number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Colour family for the filled range + thumb ring. Defaults to the accent. */
  tone?: SliderTone;
  /**
   * Tick marks under (or beside) the track. `true` derives them from `step`;
   * an array places marks at exact values; objects add a short label.
   */
  marks?: boolean | Array<number | { value: number; label?: React.ReactNode }>;
  /** Render a live value read-out above the track (mirrors each thumb). */
  showValue?: boolean;
  /** Stack the track vertically. Give the wrapper a height in vertical mode. */
  vertical?: boolean;
  /** Accessible name per thumb (string applies to all; array maps by index). */
  ariaLabel?: string | string[];
  /** Format the displayed value (read-out + mark labels). */
  formatValue?: (value: number) => React.ReactNode;
}

/** Normalise a single-number / array value into the array Radix expects. */
function toArray(v: number | number[] | undefined): number[] | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v : [v];
}

/** Build the resolved mark list: { value, label }[] in ascending order. */
function resolveMarks(
  marks: SliderProps['marks'],
  min: number,
  max: number,
  step: number,
  format: (n: number) => React.ReactNode,
): Array<{ value: number; label?: React.ReactNode }> {
  if (!marks) return [];
  if (marks === true) {
    const out: Array<{ value: number; label?: React.ReactNode }> = [];
    // Guard against a zero / negative step producing an unbounded loop.
    const s = step > 0 ? step : (max - min) / 10 || 1;
    for (let v = min; v <= max + 1e-9; v += s) {
      out.push({ value: Math.round(v * 1e6) / 1e6 });
    }
    return out;
  }
  return marks
    .map((m) => (typeof m === 'number' ? { value: m } : m))
    .filter((m) => m.value >= min && m.value <= max)
    .sort((a, b) => a.value - b.value)
    .map((m) => ({ value: m.value, label: m.label }));
}

/** Position a mark/read-out along the track as a 0..100% offset. */
function pct(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * 100;
}

export const Slider = React.forwardRef<
  React.ElementRef<typeof RadixSlider.Root>,
  SliderProps
>(function Slider(
  {
    value,
    defaultValue,
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    tone = 'accent',
    marks = false,
    showValue = false,
    vertical = false,
    ariaLabel,
    formatValue,
    className,
    ...rest
  },
  ref,
) {
  // Remember whether the caller works in scalars or arrays so we echo it back.
  const isScalar = typeof (value ?? defaultValue) === 'number';

  const valueArr = toArray(value);
  const defaultArr = toArray(defaultValue) ?? (value == null ? [min] : undefined);

  const fmt = React.useCallback(
    (n: number): React.ReactNode => (formatValue ? formatValue(n) : n),
    [formatValue],
  );

  const handleChange = React.useCallback(
    (next: number[]) => {
      if (!onValueChange) return;
      onValueChange(isScalar && next.length === 1 ? next[0] : next);
    },
    [onValueChange, isScalar],
  );

  // The current values to render thumbs + read-outs against (controlled first).
  const current = valueArr ?? defaultArr ?? [min];
  const thumbCount = Math.max(current.length, 1);

  const resolvedMarks = React.useMemo(
    () => resolveMarks(marks, min, max, step, fmt),
    [marks, min, max, step, fmt],
  );

  const labelFor = (i: number): string | undefined =>
    Array.isArray(ariaLabel) ? ariaLabel[i] : ariaLabel;

  const cls = [
    'u-slider',
    `u-slider--${tone}`,
    vertical ? 'u-slider--vertical' : 'u-slider--horizontal',
    disabled && 'is-disabled',
    showValue && 'u-slider--with-value',
    resolvedMarks.length > 0 && 'u-slider--with-marks',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={cls} data-disabled={disabled || undefined}>
      {showValue ? (
        <span className="u-slider__values" aria-hidden="true">
          {current.map((v, i) => (
            <span
              key={i}
              className="u-slider__value"
              style={offsetStyle(pct(v, min, max), vertical)}
            >
              {fmt(v)}
            </span>
          ))}
        </span>
      ) : null}

      <RadixSlider.Root
        ref={ref}
        className="u-slider__root"
        value={valueArr}
        defaultValue={valueArr ? undefined : defaultArr}
        onValueChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        orientation={vertical ? 'vertical' : 'horizontal'}
        {...rest}
      >
        <RadixSlider.Track className="u-slider__track">
          <RadixSlider.Range className="u-slider__range" />
        </RadixSlider.Track>

        {resolvedMarks.length > 0 ? (
          <span className="u-slider__marks" aria-hidden="true">
            {resolvedMarks.map((m) => (
              <span
                key={m.value}
                className="u-slider__mark"
                style={offsetStyle(pct(m.value, min, max), vertical)}
              >
                <span className="u-slider__mark-dot" />
                {m.label != null ? (
                  <span className="u-slider__mark-label">{m.label}</span>
                ) : null}
              </span>
            ))}
          </span>
        ) : null}

        {Array.from({ length: thumbCount }).map((_, i) => (
          <RadixSlider.Thumb
            key={i}
            className="u-slider__thumb"
            aria-label={labelFor(i)}
          />
        ))}
      </RadixSlider.Root>
    </span>
  );
});

/** Place an element at a percentage along the active axis, centred on it. */
function offsetStyle(percent: number, vertical: boolean): React.CSSProperties {
  return vertical
    ? { bottom: `${percent}%` }
    : { left: `${percent}%` };
}

export default Slider;
