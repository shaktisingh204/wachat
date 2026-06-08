'use client';

/**
 * 20ui — AlertDialog (destructive confirm).
 *
 * A thin, token-skinned wrapper around `@radix-ui/react-alert-dialog`. Radix owns
 * the dialog contract that matters for a *confirmation* (focus trap + restore,
 * Escape-to-cancel, `role="alertdialog"`, the title/description ARIA wiring, and
 * — unlike a plain dialog — it does NOT dismiss on overlay click, so a
 * destructive action is never lost to a stray tap). 20ui supplies the look: a
 * dimming scrim, a centred surface panel on `--u-elev-3` with a large radius, an
 * Emil centred scale-in, and an `Action` that defaults to the danger button skin
 * with `Cancel` as the calm secondary.
 *
 * The portalled overlay + content mount to `document.body`, so the layer wrapper
 * carries `className="20ui sabcrm-twenty"` — that way the `--st-*` / `--u-*`
 * tokens resolve no matter where in the app the trigger lives.
 *
 *   <AlertDialog>
 *     <AlertDialogTrigger asChild>
 *       <Button variant="danger">Delete lead</Button>
 *     </AlertDialogTrigger>
 *     <AlertDialogContent>
 *       <AlertDialogHeader>
 *         <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
 *         <AlertDialogDescription>
 *           This removes Acme Corp and its 3 notes. You cannot undo this.
 *         </AlertDialogDescription>
 *       </AlertDialogHeader>
 *       <AlertDialogFooter>
 *         <AlertDialogCancel>Keep lead</AlertDialogCancel>
 *         <AlertDialogAction onClick={remove}>Delete lead</AlertDialogAction>
 *       </AlertDialogFooter>
 *     </AlertDialogContent>
 *   </AlertDialog>
 */

import * as React from 'react';
import * as RadixAlertDialog from '@radix-ui/react-alert-dialog';

import './alertdialog.css';

/** Root state holder. Controlled via `open`/`onOpenChange` or left uncontrolled. */
export const AlertDialog = RadixAlertDialog.Root;

/** The element that opens the confirm. Use `asChild` to keep your own button. */
export const AlertDialogTrigger = RadixAlertDialog.Trigger;

/** Portal escape hatch (re-exported unchanged; `AlertDialogContent` bundles its own). */
export const AlertDialogPortal = RadixAlertDialog.Portal;

/**
 * The dimming scrim behind the panel. Skinned standalone so it can also be
 * composed manually; `AlertDialogContent` already renders one for you.
 */
export const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof RadixAlertDialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Overlay>
>(function AlertDialogOverlay({ className, ...rest }, ref) {
  return (
    <RadixAlertDialog.Overlay
      ref={ref}
      className={['u-alert-overlay', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

export interface AlertDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Content> {
  /** Props forwarded to the underlying `Portal` (e.g. a custom container). */
  portalProps?: React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Portal>;
}

/**
 * The centred confirm panel. Bundles the Portal + Overlay; the layer wrapper
 * carries the system classes so tokens resolve in the body portal. Forwards its
 * ref to the Radix content node so callers can measure or focus it.
 */
export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof RadixAlertDialog.Content>,
  AlertDialogContentProps
>(function AlertDialogContent({ className, children, portalProps, ...rest }, ref) {
  return (
    <RadixAlertDialog.Portal {...portalProps}>
      {/* The wrapper centres the panel + scopes tokens in the body portal. */}
      <div className="20ui sabcrm-twenty u-alert-layer">
        <AlertDialogOverlay />
        <RadixAlertDialog.Content
          ref={ref}
          className={['u-alert', className].filter(Boolean).join(' ')}
          {...rest}
        >
          {children}
        </RadixAlertDialog.Content>
      </div>
    </RadixAlertDialog.Portal>
  );
});

/** Title + description block at the top of the panel. */
export function AlertDialogHeader({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={['u-alert__header', className].filter(Boolean).join(' ')} {...rest} />;
}

/** Right-aligned action row (Cancel + Action). */
export function AlertDialogFooter({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={['u-alert__footer', className].filter(Boolean).join(' ')} {...rest} />;
}

/** Accessible title — wired to the dialog by Radix. */
export const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof RadixAlertDialog.Title>,
  React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Title>
>(function AlertDialogTitle({ className, ...rest }, ref) {
  return (
    <RadixAlertDialog.Title
      ref={ref}
      className={['u-alert__title', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

/** Supporting copy under the title — wired to the dialog by Radix. */
export const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof RadixAlertDialog.Description>,
  React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Description>
>(function AlertDialogDescription({ className, ...rest }, ref) {
  return (
    <RadixAlertDialog.Description
      ref={ref}
      className={['u-alert__desc', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

export interface AlertDialogActionProps
  extends React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Action> {
  /**
   * Visual intent of the confirm button. Defaults to `danger` because this is a
   * destructive-confirm dialog; pass `primary` for a non-destructive proceed.
   */
  intent?: 'danger' | 'primary';
}

/**
 * The confirming button (closes the dialog). Defaults to the danger button skin.
 * Reuses the shared `.u-btn` look so it stays in lockstep with `Button`.
 */
export const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof RadixAlertDialog.Action>,
  AlertDialogActionProps
>(function AlertDialogAction({ className, intent = 'danger', ...rest }, ref) {
  const cls = ['u-btn', `u-btn--${intent}`, 'u-btn--md', 'u-alert__action', className]
    .filter(Boolean)
    .join(' ');
  return <RadixAlertDialog.Action ref={ref} className={cls} {...rest} />;
});

/**
 * The dismissing button (closes the dialog, takes no action). Secondary skin so
 * it never competes with the destructive `Action`.
 */
export const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof RadixAlertDialog.Cancel>,
  React.ComponentPropsWithoutRef<typeof RadixAlertDialog.Cancel>
>(function AlertDialogCancel({ className, ...rest }, ref) {
  const cls = ['u-btn', 'u-btn--secondary', 'u-btn--md', 'u-alert__cancel', className]
    .filter(Boolean)
    .join(' ');
  return <RadixAlertDialog.Cancel ref={ref} className={cls} {...rest} />;
});

export default AlertDialog;
