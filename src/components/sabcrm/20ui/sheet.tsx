'use client';

/**
 * 20ui — Sheet.
 *
 * A side panel built on `@radix-ui/react-dialog`. Distinct from the vaul-based
 * `Drawer`: there is no drag/snap physics here — the Sheet simply slides in from
 * the chosen edge and is dismissed by Escape, an outside click, or the close
 * button. Radix owns the full dialog contract (focus trap, focus restore on
 * close, Escape, outside-click dismiss, scroll lock, and the title/description
 * ARIA wiring); 20ui supplies the surface and the per-side slide-in.
 *
 * Composition (Radix-style):
 *   <Sheet>                                 // open-state owner (controlled or not)
 *     <SheetTrigger asChild>
 *       <Button variant="secondary">Edit contact</Button>
 *     </SheetTrigger>
 *     <SheetContent side="right">           // portalled panel + dim overlay
 *       <SheetHeader>
 *         <SheetTitle>Edit contact</SheetTitle>
 *         <SheetDescription>Update the record details.</SheetDescription>
 *       </SheetHeader>
 *       ...body...
 *       <SheetFooter>
 *         <SheetClose asChild><Button>Cancel</Button></SheetClose>
 *         <Button variant="primary">Save</Button>
 *       </SheetFooter>
 *     </SheetContent>
 *   </Sheet>
 *
 * The portal + overlay roots carry `ui20 sabcrm-twenty` so the `--st-*` / `--u-*`
 * tokens resolve app-wide even when the trigger lives outside a CRM subtree.
 *
 * Emil motion: the panel translates in from its edge (transform + opacity only)
 * keyed off Radix's `data-state`; the overlay fades. The chosen edge is stamped
 * as `data-side` on the panel so the slide direction matches. `prefers-reduced-
 * motion` collapses both to a plain fade (handled in sheet.css).
 */

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { IconButton } from './button';
import './sheet.css';

export type SheetSide = 'top' | 'right' | 'bottom' | 'left';

/** Root state holder. Controlled via `open` / `onOpenChange` or left uncontrolled. */
export const Sheet = DialogPrimitive.Root;

/** The element that opens the sheet. Use `asChild` to keep your own button. */
export const SheetTrigger = DialogPrimitive.Trigger;

/** A control that dismisses the sheet (place inside `SheetContent`). */
export const SheetClose = DialogPrimitive.Close;

/** The portal that mounts the overlay + panel to `document.body`. */
export const SheetPortal = DialogPrimitive.Portal;

/**
 * The dimming scrim behind the panel. Skinned + token-scoped; rendered for you
 * by `SheetContent`, but exported for advanced layouts. Forwards its ref to the
 * Radix overlay node.
 */
export const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function SheetOverlay({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={['u-sheet__overlay', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Edge the panel slides in from. Defaults to `right`. */
  side?: SheetSide;
  /** Hide the built-in top-right close button (Escape + overlay click still dismiss). */
  hideClose?: boolean;
  /** Accessible name for the close button. */
  closeLabel?: string;
}

/**
 * The portalled panel + dimming overlay. Radix drives focus trap / restore,
 * Escape, outside-click dismiss, and scroll lock; we provide the surface and the
 * per-side slide-in. The portal + overlay roots carry `ui20 sabcrm-twenty` so
 * tokens resolve app-wide. Forwards its ref to the Radix content node.
 */
export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(function SheetContent(
  { side = 'right', hideClose = false, closeLabel = 'Close', className, children, ...rest },
  ref,
) {
  return (
    <SheetPortal>
      {/* Token scope for everything we portal to <body>. */}
      <div className="ui20 sabcrm-twenty u-sheet__layer">
        <SheetOverlay />
        <DialogPrimitive.Content
          ref={ref}
          // `data-side` drives the slide direction + edge sizing in sheet.css.
          data-side={side}
          className={['u-sheet', `u-sheet--${side}`, className].filter(Boolean).join(' ')}
          {...rest}
        >
          {children}
          {!hideClose ? (
            <DialogPrimitive.Close asChild>
              <IconButton label={closeLabel} icon={X} size="sm" className="u-sheet__x" />
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </div>
    </SheetPortal>
  );
});

/** Top region holding the title + description. */
export function SheetHeader({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <header className={['u-sheet__header', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </header>
  );
}

/** Bottom region, typically the action buttons. */
export function SheetFooter({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <footer className={['u-sheet__footer', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </footer>
  );
}

/** The sheet's accessible title — wired to the dialog by Radix (`aria-labelledby`). */
export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function SheetTitle({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={['u-sheet__title', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

/** Supporting copy under the title — wired to the dialog by Radix (`aria-describedby`). */
export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function SheetDescription({ className, ...rest }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={['u-sheet__desc', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

export default Sheet;
