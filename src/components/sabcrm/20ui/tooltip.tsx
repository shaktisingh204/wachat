'use client';

/**
 * 20ui — Tooltip.
 *
 * Wraps a single interactive child and shows a small label bubble on hover or
 * keyboard focus after a short delay; hides on leave, blur, or Escape. The
 * bubble is rendered with `StPortalPopover` so it floats above any
 * `overflow: hidden` / clipping ancestor (sidebars, table cells, etc.).
 *
 * A11y: the bubble carries `role="tooltip"` and a stable id; the trigger is
 * linked via `aria-describedby` (merged with any the child already had), so
 * the label is announced to assistive tech without changing the child's own
 * accessible name. Keyboard focus opens it instantly (no hover delay) because
 * a sighted-keyboard user has already committed to the control.
 *
 * Motion (Emil): the bubble scale-ins from its anchored edge via the shared
 * `st-popover` entrance (<150ms here) — transform/opacity only, reduced-motion
 * safe through the global layer.
 */

import * as React from 'react';

import { StPortalPopover } from '@/components/sabcrm/twenty/st-portal-popover';

import './tooltip.css';

export type TooltipPlacement = 'top' | 'bottom';

export interface TooltipProps {
  /** The bubble text. When empty/nullish the child renders with no tooltip. */
  label: React.ReactNode;
  /** Side of the trigger the bubble appears on. */
  placement?: TooltipPlacement;
  /** Hover open delay in ms (focus opens immediately). */
  openDelay?: number;
  /** A single focusable trigger element. */
  children: React.ReactElement;
}

/** Hover/focus a single child to reveal a small label bubble above everything. */
export function Tooltip({
  label,
  placement = 'top',
  openDelay = 350,
  children,
}: TooltipProps): React.JSX.Element {
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = React.useState(false);
  const tooltipId = React.useId();

  const hasLabel = label != null && label !== '';

  const clearTimer = React.useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = React.useCallback(
    (immediate: boolean) => {
      clearTimer();
      if (immediate || openDelay <= 0) {
        setOpen(true);
        return;
      }
      timerRef.current = setTimeout(() => setOpen(true), openDelay);
    },
    [clearTimer, openDelay],
  );

  const hide = React.useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  // Clear any pending open timer on unmount.
  React.useEffect(() => clearTimer, [clearTimer]);

  // Escape closes while open (the trigger keeps focus).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hide]);

  const child = React.Children.only(children) as React.ReactElement<
    Record<string, unknown> & { ref?: React.Ref<HTMLElement> }
  >;

  if (!hasLabel) return child;

  const childProps = child.props;
  const mergeRef = (node: HTMLElement | null): void => {
    anchorRef.current = node;
    const r = (child as { ref?: React.Ref<HTMLElement> }).ref;
    if (typeof r === 'function') r(node);
    else if (r && typeof r === 'object') {
      (r as React.MutableRefObject<HTMLElement | null>).current = node;
    }
  };

  const describedBy = [childProps['aria-describedby'], open ? tooltipId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  const chain =
    <H extends (e: never) => void>(theirs: H | undefined, ours: (e: never) => void) =>
    (e: never): void => {
      theirs?.(e);
      ours(e);
    };

  const trigger = React.cloneElement(child, {
    ref: mergeRef,
    'aria-describedby': describedBy,
    onMouseEnter: chain(childProps.onMouseEnter as undefined, () => show(false)),
    onMouseLeave: chain(childProps.onMouseLeave as undefined, hide),
    onFocus: chain(childProps.onFocus as undefined, () => show(true)),
    onBlur: chain(childProps.onBlur as undefined, hide),
  });

  return (
    <>
      {trigger}
      <StPortalPopover
        anchorRef={anchorRef}
        open={open}
        onClose={hide}
        placement={placement}
        align="start"
        gap={6}
        role="tooltip"
        className="u-tooltip"
      >
        <span id={tooltipId} className="u-tooltip__label">
          {label}
        </span>
      </StPortalPopover>
    </>
  );
}

export default Tooltip;
