'use client';

/**
 * 20ui — ScrollArea + ScrollBar.
 *
 * A thin, token-skinned wrapper around `@radix-ui/react-scroll-area`. Radix owns
 * the hard parts (cross-browser custom scrollbars that respect native scroll
 * physics, hover/scroll visibility, RTL, thumb dragging); 20ui supplies the look:
 * a hairline track that stays out of the way, a rounded thumb on `--st-border-strong`
 * that brightens on hover, and a viewport that fills its box.
 *
 * The Radix `type` defaults to `"hover"` so the scrollbar fades in on interaction
 * and fades back out, keeping dense surfaces calm. Emil polish lives in the CSS:
 * the bar's opacity transition is the only motion, and it collapses under
 * `prefers-reduced-motion`.
 *
 * Native scrolling means keyboard + screen-reader behaviour is preserved for free
 * (the viewport is a real scroll container); the decorative scrollbar/thumb are
 * `aria-hidden` by Radix. Forwards refs on both the root and the scrollbar.
 *
 *   <ScrollArea style={{ height: 280 }}>
 *     <div style={{ padding: 16 }}>... long content ...</div>
 *   </ScrollArea>
 */

import * as React from 'react';
import * as RadixScrollArea from '@radix-ui/react-scroll-area';

import './scrollarea.css';

export interface ScrollAreaProps
  extends React.ComponentPropsWithoutRef<typeof RadixScrollArea.Root> {
  /** Extra class on the inner scrolling viewport. */
  viewportClassName?: string;
  /** Ref to the inner viewport element (the actual scroll container). */
  viewportRef?: React.Ref<HTMLDivElement>;
  /** Render a horizontal scrollbar alongside the vertical one. */
  horizontal?: boolean;
}

/**
 * The scroll container. Wraps its children in a Radix viewport and pairs it with
 * a vertical (and optionally horizontal) skinned scrollbar plus the corner.
 */
export const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof RadixScrollArea.Root>,
  ScrollAreaProps
>(function ScrollArea(
  {
    className,
    viewportClassName,
    viewportRef,
    horizontal = false,
    children,
    type = 'hover',
    ...rest
  },
  ref,
) {
  return (
    <RadixScrollArea.Root
      ref={ref}
      type={type}
      className={['u-scrollarea', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <RadixScrollArea.Viewport
        ref={viewportRef}
        className={['u-scrollarea__viewport', viewportClassName]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </RadixScrollArea.Viewport>
      <ScrollBar orientation="vertical" />
      {horizontal ? <ScrollBar orientation="horizontal" /> : null}
      <RadixScrollArea.Corner className="u-scrollarea__corner" />
    </RadixScrollArea.Root>
  );
});

export interface ScrollBarProps
  extends React.ComponentPropsWithoutRef<
    typeof RadixScrollArea.ScrollAreaScrollbar
  > {}

/**
 * The skinned scrollbar track + thumb. Orientation defaults to vertical. Usually
 * rendered for you by `ScrollArea`, but exported for hand-composed layouts that
 * mount their own Radix `Root` + `Viewport`.
 */
export const ScrollBar = React.forwardRef<
  React.ComponentRef<typeof RadixScrollArea.ScrollAreaScrollbar>,
  ScrollBarProps
>(function ScrollBar({ className, orientation = 'vertical', ...rest }, ref) {
  return (
    <RadixScrollArea.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      className={[
        'u-scrollbar',
        `u-scrollbar--${orientation}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <RadixScrollArea.ScrollAreaThumb className="u-scrollbar__thumb" />
    </RadixScrollArea.ScrollAreaScrollbar>
  );
});

export default ScrollArea;
