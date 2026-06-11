'use client';

import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/sabcrm/20ui';

export interface ConfirmActionProps {
  open: boolean;
  onClose: () => void;
  /**
   * Runs when the user confirms. May be async — the dialog stays open (and
   * busy) until it settles, then closes itself on success. If it throws, the
   * dialog stays open so the caller's error toast is read in context.
   */
  onConfirm: () => void | Promise<void>;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  /** Visual intent of the confirm button. Defaults to `danger`. */
  tone?: 'danger' | 'primary';
  /** External busy flag (e.g. a server action in flight) — disables both buttons. */
  loading?: boolean;
}

/**
 * Confirmation dialog for destructive / consequential SabPay actions
 * (revoke key, cancel subscription, deactivate link, …). Built on the 20ui
 * `AlertDialog`, so Escape cancels and overlay clicks never confirm.
 */
export function ConfirmAction({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading = false,
}: ConfirmActionProps): React.JSX.Element {
  const [pending, setPending] = React.useState(false);
  const busy = loading || pending;

  async function handleConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    // Keep Radix from closing immediately — we close after onConfirm settles.
    e.preventDefault();
    if (busy) return;
    setPending(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            intent={tone}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={handleConfirm}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
