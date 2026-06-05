'use client';

/**
 * 20ui — Dock + DockIcon.
 *
 * A macOS-style icon dock with hover magnification. The icon nearest the cursor
 * (and, more gently, its two neighbours) grows; everything settles back when the
 * pointer leaves. A floating tooltip labels each icon on hover/focus.
 *
 * Magnification is driven entirely by CSS sibling selectors keyed off the
 * hovered icon — there is NO per-frame React state and no re-render on
 * pointermove, so the dock stays smooth under any number of icons. The Dock
 * still writes a single CSS variable (`--u-dock-mx`, the cursor's fractional
 * position within the hovered icon) on pointermove so the lift can lean toward
 * the side the cursor sits on, matching the real macOS feel; that write goes
 * through requestAnimationFrame and touches only inline style, never state.
 *
 * Motion (Emil): transform-only scale/translate on a custom ease-out, well under
 * 250ms; press gives a small scale(0.94). The whole magnify system is disabled
 * under prefers-reduced-motion (and via `magnify={false}`): icons stay a fixed
 * size and only the tooltip + focus ring remain.
 *
 * A11y: each DockIcon is a native <button> (or <a> when `href` is set) carrying
 * a required `label` as its accessible name; the tooltip is decorative
 * (aria-hidden) since the label already names the control. The dock is a <nav>
 * with an accessible name; the active icon advertises aria-current.
 */

import * as React from 'react';

import './dock.css';

/* -------------------------------------------------------------------------- */
/* Dock                                                                       */
/* -------------------------------------------------------------------------- */

export interface DockProps extends React.HTMLAttributes<HTMLElement> {
  /** Resting icon size in px (the dock scales relative to this). */
  iconSize?: number;
  /**
   * When false (or under prefers-reduced-motion), the hover magnification is
   * disabled — icons stay a fixed size; only the tooltip + lift on hover remain.
   */
  magnify?: boolean;
  /** Accessible name for the dock landmark. */
  label?: string;
  /** A row of <DockIcon /> elements. */
  children: React.ReactNode;
}

/**
 * The dock surface — a frosted bar that lays its <DockIcon> children in a row
 * and magnifies the one under the cursor. Pass `magnify={false}` for a static
 * dock (also forced off under reduced-motion).
 */
export const Dock = React.forwardRef<HTMLElement, DockProps>(function Dock(
  {
    iconSize = 48,
    magnify = true,
    label = 'Dock',
    className,
    children,
    style,
    ...rest
  },
  forwardedRef,
) {
  const innerRef = React.useRef<HTMLElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const pendingX = React.useRef<number | null>(null);

  const setRef = React.useCallback(
    (node: HTMLElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    [forwardedRef],
  );

  // Flush the pending cursor position to a CSS var on the hovered <li> via the
  // dock root, inside rAF so a burst of pointermove events coalesces into one
  // style write per frame (no React state, no re-render).
  const flush = React.useCallback(() => {
    rafRef.current = null;
    const root = innerRef.current;
    const clientX = pendingX.current;
    if (!root || clientX == null) return;

    // Find the icon the cursor is currently over and express the cursor's
    // horizontal position inside it as a 0..1 fraction. CSS reads this to bias
    // the lift left/right; siblings handle the falloff on their own.
    const icons = root.querySelectorAll<HTMLElement>('[data-dock-icon]');
    for (let i = 0; i < icons.length; i += 1) {
      const el = icons[i];
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && r.width > 0) {
        const frac = (clientX - r.left) / r.width;
        el.style.setProperty('--u-dock-mx', String(Math.min(1, Math.max(0, frac))));
      } else {
        el.style.removeProperty('--u-dock-mx');
      }
    }
  }, []);

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!magnify) return;
      pendingX.current = e.clientX;
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flush);
      }
    },
    [magnify, flush],
  );

  const clearBias = React.useCallback(() => {
    const root = innerRef.current;
    if (!root) return;
    root
      .querySelectorAll<HTMLElement>('[data-dock-icon]')
      .forEach((el) => el.style.removeProperty('--u-dock-mx'));
  }, []);

  const handlePointerLeave = React.useCallback(() => {
    pendingX.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    clearBias();
  }, [clearBias]);

  // Cancel any in-flight frame on unmount so the callback can't run detached.
  React.useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const cls = ['u-dock', !magnify && 'u-dock--static', className]
    .filter(Boolean)
    .join(' ');

  return (
    <nav
      ref={setRef}
      className={cls}
      aria-label={label}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ '--u-dock-size': `${iconSize}px`, ...style } as React.CSSProperties}
      {...rest}
    >
      <span className="u-dock__aurora" aria-hidden="true" />
      <ul className="u-dock__list">{children}</ul>
    </nav>
  );
});

/* -------------------------------------------------------------------------- */
/* DockIcon                                                                    */
/* -------------------------------------------------------------------------- */

export interface DockIconProps {
  /** Required accessible name; also shown in the hover/focus tooltip. */
  label: string;
  /** The glyph — typically a lucide icon at ~22px. */
  children?: React.ReactNode;
  /** Optional image source (e.g. a module logo). Overrides `children`. */
  src?: string;
  /** Renders as an <a> when set; otherwise a <button>. */
  href?: string;
  /** Marks this icon as the current section (adds the active dot + ring). */
  active?: boolean;
  /** Click handler (button mode) or augments navigation (link mode). */
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  /** Disable the control. */
  disabled?: boolean;
  /** Extra class on the <li> wrapper. */
  className?: string;
}

/**
 * A single dock entry. Renders a native, focusable control (button or link) so
 * keyboard + screen-reader users get it for free; the tooltip is purely visual.
 */
export const DockIcon = React.forwardRef<HTMLElement, DockIconProps>(
  function DockIcon(
    { label, children, src, href, active, onClick, disabled, className },
    forwardedRef,
  ) {
    const cls = ['u-dock__item', active && 'is-active', className]
      .filter(Boolean)
      .join(' ');

    const inner = (
      <>
        <span className="u-dock__tile">
          {src ? (
            // Decorative: the control is already named by `label`.
            <img className="u-dock__img" src={src} alt="" aria-hidden="true" />
          ) : (
            <span className="u-dock__glyph" aria-hidden="true">
              {children}
            </span>
          )}
        </span>
        <span className="u-dock__tip" role="tooltip" aria-hidden="true">
          {label}
        </span>
        <span className="u-dock__dot" aria-hidden="true" />
      </>
    );

    const sharedProps = {
      className: 'u-dock__btn',
      'aria-label': label,
      'aria-current': active ? ('page' as const) : undefined,
      onClick: disabled ? undefined : onClick,
    };

    return (
      <li className={cls} data-dock-icon>
        {href != null ? (
          <a
            ref={forwardedRef as React.Ref<HTMLAnchorElement>}
            href={disabled ? undefined : href}
            aria-disabled={disabled || undefined}
            {...sharedProps}
          >
            {inner}
          </a>
        ) : (
          <button
            ref={forwardedRef as React.Ref<HTMLButtonElement>}
            type="button"
            disabled={disabled}
            {...sharedProps}
          >
            {inner}
          </button>
        )}
      </li>
    );
  },
);

export default Dock;
