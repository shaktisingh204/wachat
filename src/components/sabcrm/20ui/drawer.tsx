'use client';

/**
 * 20ui — Drawer.
 *
 * A side panel that slides in from any edge, built on `vaul`. Vaul hands us the
 * full overlay-dialog contract for free: focus trap, focus restore on close,
 * Escape-to-dismiss, outside-click dismiss, and body scroll lock. We skin it
 * with the 20ui tokens and add the slide-in transforms per side.
 *
 * Composition (Radix-style, like vaul itself):
 *   <Drawer>                              // open-state owner (controlled or not)
 *     <DrawerTrigger>Open</DrawerTrigger> // any clickable; asChild by default
 *     <DrawerContent side="right">        // portalled panel + dim overlay
 *       <DrawerHeader>
 *         <DrawerTitle>Edit contact</DrawerTitle>
 *         <DrawerDescription>Update the record details.</DrawerDescription>
 *       </DrawerHeader>
 *       ...body...
 *       <DrawerFooter>
 *         <DrawerClose asChild><Button>Cancel</Button></DrawerClose>
 *         <Button variant="primary">Save</Button>
 *       </DrawerFooter>
 *     </DrawerContent>
 *   </Drawer>
 *
 * The portal root carries `ui20 sabcrm-twenty` so the `--st-*` / `--u-*` tokens
 * resolve app-wide even when the trigger lives outside a CRM subtree.
 *
 * Emil motion: the panel translates in from its edge (transform only) on the
 * drawer easing; the overlay fades. `prefers-reduced-motion` collapses to a
 * plain fade for both (handled in drawer.css).
 */

import * as React from 'react';
import { Drawer as Vaul } from 'vaul';
import { X } from 'lucide-react';

import { IconButton } from './button';
import './drawer.css';

export type DrawerSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * The chosen side is set on `<DrawerContent>` but vaul's drag/snap physics live
 * on the Root via its `direction` prop. This context bridges the two so the
 * panel slides AND drags from the same edge with a single `side` prop.
 */
const DrawerSideContext = React.createContext<DrawerSide>('right');

export interface DrawerProps
  extends Omit<React.ComponentProps<typeof Vaul.Root>, 'direction'> {
  /**
   * Edge the panel slides in from. Defaults to `right`. Set it here (or, for
   * convenience, on `<DrawerContent>`) — both stay in sync.
   */
  side?: DrawerSide;
}

/**
 * The drawer root. Owns open state (controlled via `open` / `onOpenChange`, or
 * uncontrolled) and the slide direction. Forwarding the rest of vaul's props
 * keeps the full API (e.g. `dismissible`, `modal`, `nested`) available.
 */
export function Drawer({ side = 'right', children, ...rest }: DrawerProps): React.JSX.Element {
  return (
    <DrawerSideContext.Provider value={side}>
      <Vaul.Root direction={side} {...rest}>
        {children}
      </Vaul.Root>
    </DrawerSideContext.Provider>
  );
}

/**
 * The element that opens the drawer. Renders as a real `<button>` by default;
 * pass `asChild` to project the trigger onto your own element (e.g. a 20ui
 * `<Button>`) without an extra wrapper.
 */
export const DrawerTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Vaul.Trigger>
>(function DrawerTrigger({ className, ...rest }, ref) {
  return (
    <Vaul.Trigger
      ref={ref}
      className={['u-drawer__trigger', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof Vaul.Content> {
  /**
   * Edge the panel slides in from. Optional here — defaults to the `side` set
   * on `<Drawer>` (or `right`). Pass it on either component.
   */
  side?: DrawerSide;
  /** Hide the built-in top-right close button. */
  hideClose?: boolean;
  /** Accessible name for the close button. */
  closeLabel?: string;
}

/**
 * The portalled panel + dimming overlay. Vaul drives focus trap / restore,
 * Escape, outside-click, and scroll lock; we provide the surface and the
 * per-side slide-in. The portal + overlay roots carry `ui20 sabcrm-twenty` so
 * tokens resolve app-wide.
 *
 * Vaul stamps `data-vaul-drawer-direction` on the content node, which our CSS
 * uses to size and translate the panel for the chosen edge.
 */
export const DrawerContent = React.forwardRef<HTMLDivElement, DrawerContentProps>(
  function DrawerContent(
    { side: sideProp, hideClose = false, closeLabel = 'Close', className, children, ...rest },
    ref,
  ) {
    const ctxSide = React.useContext(DrawerSideContext);
    const side = sideProp ?? ctxSide;
    return (
      <Vaul.Portal>
        {/* Token scope for everything we portal to <body>. */}
        <div className="ui20 sabcrm-twenty u-drawer__layer">
          <Vaul.Overlay className="u-drawer__overlay" />
          <Vaul.Content
            ref={ref}
            // Vaul reads `direction` from Root and stamps it on this node as
            // `data-vaul-drawer-direction`; our `--{side}` modifier sizes and
            // translates the panel to match that edge.
            className={['u-drawer', `u-drawer--${side}`, className].filter(Boolean).join(' ')}
            {...rest}
          >
            {!hideClose ? (
              <Vaul.Close asChild>
                <IconButton label={closeLabel} icon={X} size="sm" className="u-drawer__x" />
              </Vaul.Close>
            ) : null}
            {children}
          </Vaul.Content>
        </div>
      </Vaul.Portal>
    );
  },
);

/** Sticky top region holding the title + description. */
export function DrawerHeader({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <header className={['u-drawer__header', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </header>
  );
}

/** The drawer's accessible title — wired to the dialog by vaul. */
export const DrawerTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof Vaul.Title>
>(function DrawerTitle({ className, ...rest }, ref) {
  return (
    <Vaul.Title
      ref={ref}
      className={['u-drawer__title', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

/** Supporting copy under the title — wired to the dialog by vaul. */
export const DrawerDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof Vaul.Description>
>(function DrawerDescription({ className, ...rest }, ref) {
  return (
    <Vaul.Description
      ref={ref}
      className={['u-drawer__desc', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

/** Sticky bottom region, typically the action buttons. */
export function DrawerFooter({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <footer className={['u-drawer__footer', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </footer>
  );
}

/**
 * Closes the drawer. Renders a real `<button>` by default; pass `asChild` to
 * close from your own control (e.g. a 20ui `<Button>` in the footer).
 */
export const DrawerClose = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Vaul.Close>
>(function DrawerClose({ className, ...rest }, ref) {
  return (
    <Vaul.Close
      ref={ref}
      className={['u-drawer__close', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

export default Drawer;
