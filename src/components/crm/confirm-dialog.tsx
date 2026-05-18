'use client';

import {
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
} from '@/components/zoruui';
import {
  Loader2 } from 'lucide-react';

/**
 * <ConfirmDialog/> — destructive-action confirmation modal.
 *
 * A reusable confirmation modal for destructive (or otherwise consequential)
 * actions. Supports an optional typed-verification step where the user must
 * retype an exact string (typically the entity name, or the literal
 * "DELETE") before the Confirm button enables. The Confirm button shows a
 * spinner while the supplied `onConfirm` promise is resolving so callers
 * can safely run async work (server-action calls, route refreshes, etc.)
 * without juggling their own loading state.
 *
 * Built on the zoruui primitives (`ZoruDialog*`, `ZoruButton`, `ZoruInput`)
 * — never wire a bare `<dialog>` or shadcn primitive directly when you can
 * use this wrapper.
 *
 * @example Simple confirmation
 * ```tsx
 * const [open, setOpen] = React.useState(false);
 * <ConfirmDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Archive this lead?"
 *   description="You can restore it later from the archive view."
 *   confirmLabel="Archive"
 *   confirmTone="primary"
 *   onConfirm={async () => { await archiveLead(id); }}
 * />
 * ```
 *
 * @example Type-to-confirm for a destructive action
 * ```tsx
 * <ConfirmDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Delete account?"
 *   description="This permanently removes the account and all related records."
 *   requireTyped={account.name}
 *   onConfirm={async () => { await deleteAccount(account.id); }}
 * />
 * ```
 */

import * as React from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** When set, user must type the entity's name (or just "DELETE") to enable Confirm. */
  requireTyped?: string;
  /** Button label, defaults to "Delete". */
  confirmLabel?: string;
  /** Visual tone for the confirm button. Defaults to "danger". */
  confirmTone?: 'danger' | 'primary';
  /** Called when user clicks confirm (after typed verification if required). */
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  requireTyped,
  confirmLabel = 'Delete',
  confirmTone = 'danger',
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = React.useState('');
  const [isPending, setIsPending] = React.useState(false);

  // Reset transient state every time the dialog closes so a re-open starts
  // fresh. We intentionally don't reset on open — guarding against an
  // accidental confirm requires deliberate typing each session.
  React.useEffect(() => {
    if (!open) {
      setTyped('');
      setIsPending(false);
    }
  }, [open]);

  const needsTyped = typeof requireTyped === 'string' && requireTyped.length > 0;
  const typedMatches = needsTyped ? typed === requireTyped : true;
  const confirmDisabled = isPending || !typedMatches;

  const handleConfirm = React.useCallback(async () => {
    if (confirmDisabled) return;
    setIsPending(true);
    try {
      await onConfirm();
      // Close on success; callers that want to keep the dialog open after
      // confirm can simply throw or never resolve their promise.
      onOpenChange(false);
    } catch (err) {
      // Re-enable the confirm button so the user can retry. Bubble the
      // error so callers can surface it via their own toast/log path.
      setIsPending(false);
      throw err;
    }
  }, [confirmDisabled, onConfirm, onOpenChange]);

  const handleCancel = React.useCallback(() => {
    if (isPending) return; // never cancel mid-flight
    onOpenChange(false);
  }, [isPending, onOpenChange]);

  // Allow the user to press Enter inside the typed-confirmation input to
  // submit, which matches the muscle-memory of an inline form.
  const handleInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !confirmDisabled) {
        e.preventDefault();
        void handleConfirm();
      }
    },
    [confirmDisabled, handleConfirm],
  );

  const confirmVariant = confirmTone === 'danger' ? 'destructive' : 'default';

  return (
    <ZoruDialog open={open} onOpenChange={(next) => (isPending ? null : onOpenChange(next))}>
      <ZoruDialogContent className="sm:max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>{title}</ZoruDialogTitle>
          {description ? (
            <ZoruDialogDescription>{description}</ZoruDialogDescription>
          ) : null}
        </ZoruDialogHeader>

        {needsTyped ? (
          <div className="flex flex-col gap-2">
            <ZoruLabel htmlFor="confirm-dialog-typed">
              Type{' '}
              <span className="font-mono text-zoru-ink">{requireTyped}</span>{' '}
              to confirm
            </ZoruLabel>
            <ZoruInput
              id="confirm-dialog-typed"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={handleInputKeyDown}
              invalid={typed.length > 0 && !typedMatches}
              disabled={isPending}
            />
          </div>
        ) : null}

        <ZoruDialogFooter>
          <ZoruButton
            type="button"
            variant="secondary"
            onClick={handleCancel}
            disabled={isPending}
          >
            Cancel
          </ZoruButton>
          <ZoruButton
            type="button"
            variant={confirmVariant}
            onClick={() => {
              void handleConfirm();
            }}
            disabled={confirmDisabled}
            aria-busy={isPending || undefined}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                <span>Working…</span>
              </>
            ) : (
              confirmLabel
            )}
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
