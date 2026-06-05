'use client';

/**
 * 20ui — Dialog (compound, Radix-driven).
 *
 * A thin, token-skinned wrapper around `@radix-ui/react-dialog`. Radix owns the
 * full modal-dialog contract: focus trap + restore, Escape-to-close, click the
 * overlay to dismiss, body-scroll lock, and the `role="dialog"` / `aria-modal`
 * + title/description ARIA wiring. 20ui supplies the look: a dimming scrim, a
 * centred surface panel on `--u-elev-3` with a large radius, an Emil centred
 * scale-in (0.96 -> 1 + fade), and a top-right close (X) button.
 *
 * This is the COMPOUND dialog — distinct from the props-based `Modal` in
 * modal.tsx. Use this when you want shadcn-style composition (Trigger / Content
 * / Header / Footer / Title / Description / Close) with `asChild` triggers.
 *
 * The portalled overlay + content mount to `document.body`, so the layer wrapper
 * carries `className="ui20 sabcrm-twenty"` — that way the `--st-*` / `--u-*`
 * tokens resolve no matter where in the app the trigger lives.
 *
 *   <Dialog>
 *     <DialogTrigger asChild>
 *       <Button variant="secondary">Edit lead</Button>
 *     </DialogTrigger>
 *     <DialogContent>
 *       <DialogHeader>
 *         <DialogTitle>Edit lead</DialogTitle>
 *         <DialogDescription>Update the details for Acme Corp.</DialogDescription>
 *       </DialogHeader>
 *       <form id="edit-lead">…</form>
 *       <DialogFooter>
 *         <DialogClose asChild>
 *           <Button variant="secondary">Cancel</Button>
 *         </DialogClose>
 *         <Button type="submit" form="edit-lead">Save</Button>
 *       </DialogFooter>
 *     </DialogContent>
 *   </Dialog>
 */

import * as React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import './dialog.css';

const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/** Root state holder. Controlled via `open`/`onOpenChange` or left uncontrolled. */
export const Dialog = RadixDialog.Root;

/** The element that opens the dialog. Use `asChild` to keep your own button. */
export const DialogTrigger = RadixDialog.Trigger;

/** Portal escape hatch (re-exported unchanged; `DialogContent` bundles its own). */
export const DialogPortal = RadixDialog.Portal;

/** A control that closes the dialog. Use `asChild` to wrap your own button. */
export const DialogClose = RadixDialog.Close;

/**
 * The dimming scrim behind the panel. Skinned standalone so it can also be
 * composed manually; `DialogContent` already renders one for you. Forwards its
 * ref to the Radix overlay node.
 */
export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Overlay>
>(function DialogOverlay({ className, ...rest }, ref) {
  return <RadixDialog.Overlay ref={ref} className={cx('u-dialog-overlay', className)} {...rest} />;
});

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixDialog.Content> {
  /** Hide the top-right close (X) button. */
  hideClose?: boolean;
  /**
   * Extra classes for the dim backdrop. Used to raise a dialog's stacking
   * order (e.g. a file picker opened from inside another, higher-z modal).
   */
  overlayClassName?: string;
  /** Props forwarded to the underlying `Portal` (e.g. a custom container). */
  portalProps?: React.ComponentPropsWithoutRef<typeof RadixDialog.Portal>;
}

/**
 * The centred dialog panel. Bundles the Portal + Overlay; the layer wrapper
 * carries the system classes so tokens resolve in the body portal. Renders a
 * top-right close button unless `hideClose`. Forwards its ref to the Radix
 * content node so callers can measure or focus it.
 */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  DialogContentProps
>(function DialogContent(
  { className, overlayClassName, children, hideClose, portalProps, ...rest },
  ref,
) {
  return (
    <RadixDialog.Portal {...portalProps}>
      {/* The wrapper centres the panel + scopes tokens in the body portal. */}
      <div className="ui20 sabcrm-twenty u-dialog-layer">
        <DialogOverlay className={overlayClassName} />
        <RadixDialog.Content ref={ref} className={cx('u-dialog', className)} {...rest}>
          {children}
          {!hideClose ? (
            <RadixDialog.Close aria-label="Close" className="u-dialog__close">
              <X className="u-dialog__close-icon" aria-hidden="true" />
            </RadixDialog.Close>
          ) : null}
        </RadixDialog.Content>
      </div>
    </RadixDialog.Portal>
  );
});

/** Title + description block at the top of the panel. */
export function DialogHeader({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cx('u-dialog__header', className)} {...rest} />;
}

/** Right-aligned action row (stacks on narrow viewports). */
export function DialogFooter({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cx('u-dialog__footer', className)} {...rest} />;
}

/** Accessible title — wired to the dialog by Radix. */
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Title>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Title>
>(function DialogTitle({ className, ...rest }, ref) {
  return <RadixDialog.Title ref={ref} className={cx('u-dialog__title', className)} {...rest} />;
});

/** Supporting copy under the title — wired to the dialog by Radix. */
export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Description>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Description>
>(function DialogDescription({ className, ...rest }, ref) {
  return (
    <RadixDialog.Description ref={ref} className={cx('u-dialog__desc', className)} {...rest} />
  );
});

export default Dialog;
