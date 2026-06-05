'use client';

/**
 * StPortalPopover — a portal-rendered, anchor-positioned popover for the
 * SabCRM Twenty surface.
 *
 * Twenty-style dropdowns (the workspace switcher, the notifications bell, the
 * tag pickers, the new `StSelect`) all live inside containers that clip their
 * children — most notably `.st-sidebar { overflow: hidden }`. Rendering a
 * popover as a positioned child of those containers gets it clipped at the
 * container edge regardless of `z-index`. This helper sidesteps that entirely:
 * it renders into `document.body` (so no ancestor `overflow`/`transform` can
 * clip it) and positions itself with `position: fixed` against the live
 * bounding rect of an anchor element, re-measuring on scroll + resize.
 *
 * It owns nothing about *what* is shown — callers pass arbitrary children — and
 * handles only: mount/unmount, positioning, and outside-click / Escape close.
 * Pointer events that originate inside the anchor are ignored so a trigger that
 * toggles `open` doesn't immediately re-close on the same click.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';

export type StPopoverPlacement = 'bottom' | 'top';
export type StPopoverAlign = 'start' | 'end';

export type StPortalPopoverProps = {
  /** The element the popover anchors to (its trigger). */
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** Vertical placement relative to the anchor. */
  placement?: StPopoverPlacement;
  /** Horizontal edge alignment relative to the anchor. */
  align?: StPopoverAlign;
  /** Gap in px between anchor and popover. */
  gap?: number;
  /** When set, the popover's min-width matches the anchor width. */
  matchWidth?: boolean;
  className?: string;
  role?: string;
  ariaLabel?: string;
  children: React.ReactNode;
};

type Coords = { top: number; left: number; minWidth: number; placement: StPopoverPlacement };

export function StPortalPopover({
  anchorRef,
  open,
  onClose,
  placement = 'bottom',
  align = 'start',
  gap = 6,
  matchWidth = false,
  className,
  role = 'dialog',
  ariaLabel,
  children,
}: StPortalPopoverProps): React.JSX.Element | null {
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [coords, setCoords] = React.useState<Coords | null>(null);

  // Portals are client-only; defer until after hydration.
  React.useEffect(() => setMounted(true), []);

  const reposition = React.useCallback(() => {
    const anchor = anchorRef.current;
    const pop = popoverRef.current;
    if (!anchor) return;
    const a = anchor.getBoundingClientRect();
    const popH = pop?.offsetHeight ?? 0;
    const popW = pop?.offsetWidth ?? a.width;

    // Flip to top when there isn't room below.
    let resolved: StPopoverPlacement = placement;
    if (placement === 'bottom' && a.bottom + gap + popH > window.innerHeight && a.top - gap - popH > 0) {
      resolved = 'top';
    }
    const top = resolved === 'bottom' ? a.bottom + gap : a.top - gap - popH;

    // Horizontal alignment, clamped into the viewport with an 8px margin.
    let left = align === 'end' ? a.right - popW : a.left;
    const margin = 8;
    left = Math.min(Math.max(margin, left), window.innerWidth - popW - margin);

    setCoords({ top, left, minWidth: a.width, placement: resolved });
  }, [anchorRef, align, gap, placement]);

  // Measure once open (twice: once to mount, once with real popover size).
  React.useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    reposition();
    // A second pass after the popover has painted gives an accurate height for
    // the flip + top-placement math.
    const raf = window.requestAnimationFrame(reposition);
    return () => window.cancelAnimationFrame(raf);
  }, [open, reposition]);

  // Keep the popover glued to the anchor while scrolling / resizing.
  React.useEffect(() => {
    if (!open) return;
    const onScroll = () => reposition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, reposition]);

  // Outside-click + Escape close. Clicks inside the anchor are ignored so the
  // trigger's own onClick stays in control of toggling.
  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!mounted || !open) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    top: coords?.top ?? -9999,
    left: coords?.left ?? -9999,
    visibility: coords ? 'visible' : 'hidden',
    ...(matchWidth && coords ? { minWidth: coords.minWidth } : null),
  };

  return createPortal(
    <div
      ref={popoverRef}
      // The portal root carries BOTH design-system roots so its `--st-*` tokens
      // resolve wherever it mounts: `sabcrm-twenty` for the CRM, and `ui20` for
      // the app-wide 20ui system (a body-mounted portal is not a descendant of
      // either app frame). Whichever stylesheet is loaded supplies the tokens;
      // the other class is inert.
      className={['ui20', 'sabcrm-twenty', 'st-popover', className].filter(Boolean).join(' ')}
      role={role}
      aria-label={ariaLabel}
      data-placement={coords?.placement ?? placement}
      style={style}
    >
      {children}
    </div>,
    document.body,
  );
}

export default StPortalPopover;
