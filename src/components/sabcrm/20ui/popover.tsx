'use client';

/**
 * 20ui — Popover.
 *
 * A thin, token-skinned wrapper around `@radix-ui/react-popover`. Radix owns the
 * hard parts (focus management, outside-click + Escape dismissal, collision-aware
 * positioning, the trigger/content ARIA wiring); 20ui supplies the look: a
 * surface panel on `--u-elev-3`, a large radius, and an Emil scale-in that grows
 * from whichever edge Radix anchored the panel to (driven by `data-side`).
 *
 * The portalled content root carries `className="20ui sabcrm-twenty"` so the
 * `--st-*` / `--u-*` tokens resolve no matter where in the app the trigger lives
 * (the panel renders to `document.body`, outside the CRM subtree).
 *
 * Re-exports `Popover`, `PopoverTrigger`, `PopoverAnchor`, `PopoverClose`
 * unchanged, plus a skinned `PopoverContent` (which also bundles the Portal).
 *
 *   <Popover>
 *     <PopoverTrigger asChild>
 *       <Button variant="secondary">Filters</Button>
 *     </PopoverTrigger>
 *     <PopoverContent align="start">
 *       <p>Refine the current view.</p>
 *     </PopoverContent>
 *   </Popover>
 */

import * as React from 'react';
import * as RadixPopover from '@radix-ui/react-popover';

import './popover.css';

/** Root state holder. Controlled via `open`/`onOpenChange` or left uncontrolled. */
export const Popover = RadixPopover.Root;

/** The element that toggles the popover. Use `asChild` to keep your own button. */
export const PopoverTrigger = RadixPopover.Trigger;

/** Position the panel against a custom element instead of the trigger. */
export const PopoverAnchor = RadixPopover.Anchor;

/** A control that dismisses the popover (place inside `PopoverContent`). */
export const PopoverClose = RadixPopover.Close;

export interface PopoverContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixPopover.Content> {
  /** Render a small arrow pointing back at the trigger. */
  arrow?: boolean;
  /** Props forwarded to the underlying `Popover.Portal` (e.g. a custom container). */
  portalProps?: React.ComponentPropsWithoutRef<typeof RadixPopover.Portal>;
}

/**
 * The floating panel. Portalled to `<body>`, skinned with 20ui tokens, and
 * animated with a `data-side`-aware scale-in. Forwards its ref to the Radix
 * content node so callers can measure or focus it.
 */
export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof RadixPopover.Content>,
  PopoverContentProps
>(function PopoverContent(
  {
    className,
    children,
    arrow = false,
    portalProps,
    align = 'center',
    sideOffset = 6,
    collisionPadding = 8,
    ...rest
  },
  ref,
) {
  return (
    <RadixPopover.Portal {...portalProps}>
      {/* The wrapper carries the system classes so tokens resolve in the body
          portal; the panel itself stays a pure positioned surface. */}
      <div className="20ui sabcrm-twenty u-popover__portal">
        <RadixPopover.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={['u-popover', className].filter(Boolean).join(' ')}
          {...rest}
        >
          {children}
          {arrow ? (
            <RadixPopover.Arrow className="u-popover__arrow" width={12} height={6} />
          ) : null}
        </RadixPopover.Content>
      </div>
    </RadixPopover.Portal>
  );
});

export default Popover;
