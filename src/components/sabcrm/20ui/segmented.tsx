'use client';

/**
 * 20ui — SegmentedControl.
 *
 * A pill row of mutually-exclusive options. Built as a `role="radiogroup"` of
 * `role="radio"` buttons with a roving tabindex: arrow keys move + select the
 * active segment, Home/End jump to the ends, and only the checked segment is in
 * the tab order. The active fill is a single accent-soft pill that SLIDES between
 * segments (transform-only, custom ease-out) instead of cross-fading — Emil's
 * "animate the shared element" rule. Colour carries meaning (the selection),
 * never decoration.
 */

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { renderIcon, type IconProp } from './_icon';
import './segmented.css';

export type SegmentedSize = 'sm' | 'md';

export interface SegmentedItem<V extends string = string> {
  value: V;
  label: React.ReactNode;
  icon?: IconProp;
  /** Disable this single segment. */
  disabled?: boolean;
}

export interface SegmentedControlProps<V extends string = string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  items: ReadonlyArray<SegmentedItem<V>>;
  /** Controlled selected value. */
  value: V;
  onChange: (value: V) => void;
  size?: SegmentedSize;
  /** Stretch to fill the container; segments share the width equally. */
  fullWidth?: boolean;
  /** Accessible name for the group (recommended). */
  'aria-label'?: string;
}

const ICON_SIZE: Record<SegmentedSize, number> = { sm: 13, md: 14 };

export function SegmentedControl<V extends string = string>({
  items,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  className,
  ...rest
}: SegmentedControlProps<V>): React.JSX.Element {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const btnRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [indicator, setIndicator] = React.useState<{
    left: number;
    width: number;
    ready: boolean;
  }>({ left: 0, width: 0, ready: false });

  const activeIndex = items.findIndex((it) => it.value === value);
  // When nothing is selected, the roving tabstop goes to the first ENABLED
  // segment (a disabled button can't hold focus, which would otherwise make the
  // whole control unreachable by keyboard).
  const firstEnabledIndex = items.findIndex((it) => !it.disabled);

  // Measure the active segment so the fill can slide to it. Re-measures on
  // selection change and on resize (container reflow / font swap).
  const measure = React.useCallback(() => {
    const root = rootRef.current;
    const el = btnRefs.current[activeIndex];
    if (!root || !el) return;
    setIndicator({
      left: el.offsetLeft,
      width: el.offsetWidth,
      ready: true,
    });
  }, [activeIndex]);

  React.useLayoutEffect(() => {
    measure();
  }, [measure, items.length, size, fullWidth]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    return () => ro.disconnect();
  }, [measure]);

  const focusIndex = (index: number) => {
    const el = btnRefs.current[index];
    el?.focus();
  };

  // Move selection to the next enabled segment in `dir`, wrapping around.
  const step = (from: number, dir: 1 | -1) => {
    const n = items.length;
    for (let i = 1; i <= n; i += 1) {
      const idx = (from + dir * i + n * i) % n;
      const item = items[idx];
      if (item && !item.disabled) {
        onChange(item.value);
        focusIndex(idx);
        return;
      }
    }
  };

  const edge = (which: 'first' | 'last') => {
    const ordered =
      which === 'first'
        ? items.map((it, i) => [it, i] as const)
        : items.map((it, i) => [it, i] as const).reverse();
    for (const [item, idx] of ordered) {
      if (!item.disabled) {
        onChange(item.value);
        focusIndex(idx);
        return;
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        step(index, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        step(index, -1);
        break;
      case 'Home':
        e.preventDefault();
        edge('first');
        break;
      case 'End':
        e.preventDefault();
        edge('last');
        break;
      default:
        break;
    }
  };

  const cls = [
    'u-seg',
    `u-seg--${size}`,
    fullWidth && 'u-seg--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={rootRef} className={cls} role="radiogroup" {...rest}>
      <span
        className="u-seg__indicator"
        aria-hidden="true"
        data-ready={indicator.ready || undefined}
        style={{
          transform: `translateX(${indicator.left}px)`,
          width: indicator.width,
        }}
      />
      {items.map((item, i) => {
        const selected = item.value === value;
        const iconOnly = item.label == null || item.label === '';
        return (
          <button
            key={item.value}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={iconOnly && typeof item.value === 'string' ? item.value : undefined}
            className={['u-seg__item', selected && 'is-selected'].filter(Boolean).join(' ')}
            tabIndex={selected || (activeIndex < 0 && i === firstEnabledIndex) ? 0 : -1}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {renderIcon(item.icon, { size: ICON_SIZE[size], 'aria-hidden': true })}
            {!iconOnly ? <span className="u-seg__label">{item.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
