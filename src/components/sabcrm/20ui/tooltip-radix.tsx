'use client';

/**
 * 20ui Tooltip (compound, Radix-driven).
 *
 * A full, token-skinned wrapper around `@radix-ui/react-tooltip` that mirrors the
 * shadcn / Ui20 compound surface exactly (`Tooltip`, `TooltipProvider`,
 * `TooltipTrigger`, `TooltipContent`) so call-sites become a pure import-path
 * swap. Radix owns the hard parts: hover/focus intent with grace timers, the
 * shared open delay across a `TooltipProvider`, `role="tooltip"` +
 * `aria-describedby` wiring on the trigger, Escape + pointer-leave dismissal, and
 * collision-aware positioning.
 *
 * 20ui supplies the look: a small, dark, inverted label bubble at the `sm` text
 * size, an optional arrow that points back at the trigger, and an Emil scale-in
 * that grows from whichever edge Radix anchored to (keyed off the Radix
 * `--radix-tooltip-content-transform-origin` var, see tooltip-radix.css).
 *
 * Content portals to `<body>` through a wrapper that carries
 * `className="20ui sabcrm-twenty"`, so the `--st-*` / `--u-*` tokens resolve no
 * matter where in the app the trigger lives.
 *
 *   <TooltipProvider>
 *     <Tooltip>
 *       <TooltipTrigger asChild>
 *         <Button variant="ghost" aria-label="Archive">
 *           <Archive aria-hidden="true" />
 *         </Button>
 *       </TooltipTrigger>
 *       <TooltipContent>Archive lead</TooltipContent>
 *     </Tooltip>
 *   </TooltipProvider>
 */

import * as React from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';

import './tooltip-radix.css';

const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/**
 * Shares hover-open delay and the "skip the delay once one tooltip has opened"
 * grace window across every `Tooltip` inside it. Wrap a region (or the app root)
 * once. `Tooltip` also works standalone (Radix mounts an implicit provider),
 * but an explicit one is preferred so delays feel consistent.
 */
export const TooltipProvider = RadixTooltip.Provider;

/** Root state holder. Controlled via `open`/`onOpenChange` or left uncontrolled. */
export const Tooltip = RadixTooltip.Root;

/** The element the tooltip describes. Use `asChild` to keep your own control. */
export const TooltipTrigger = RadixTooltip.Trigger;

export interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixTooltip.Content> {
  /** Render a small arrow pointing back at the trigger. */
  arrow?: boolean;
  /** Props forwarded to the underlying `Tooltip.Portal` (e.g. a custom container). */
  portalProps?: React.ComponentPropsWithoutRef<typeof RadixTooltip.Portal>;
}

/**
 * The floating label bubble. Portalled to `<body>`, skinned with 20ui tokens, and
 * animated with a transform-origin-aware scale-in. Forwards its ref to the Radix
 * content node.
 */
export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof RadixTooltip.Content>,
  TooltipContentProps
>(function TooltipContent(
  { className, children, arrow = false, portalProps, sideOffset = 6, collisionPadding = 8, ...rest },
  ref,
) {
  return (
    <RadixTooltip.Portal {...portalProps}>
      {/* The wrapper carries the system classes so tokens resolve in the body
          portal; `display: contents` keeps it out of Radix's positioning. */}
      <div className="20ui sabcrm-twenty u-tip__portal">
        <RadixTooltip.Content
          ref={ref}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cx('u-tip', className)}
          {...rest}
        >
          {children}
          {arrow ? (
            <RadixTooltip.Arrow className="u-tip__arrow" width={11} height={5} />
          ) : null}
        </RadixTooltip.Content>
      </div>
    </RadixTooltip.Portal>
  );
});

export default Tooltip;
