'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/sabcrm/20ui';
import {
  LoaderCircle } from 'lucide-react';

/**
 * Delete confirmations used by the bookings list — extracted out of
 * <BookingListClient> to keep that file under 600 lines.
 */

import * as React from 'react';

interface SingleDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  busy: boolean;
  onConfirm: () => void;
}

export function BookingSingleDeleteDialog({
  open,
  onOpenChange,
  label,
  busy,
  onConfirm,
}: SingleDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete booking?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes <strong>{label}</strong> from the
            database. The action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={busy}
            className="bg-[var(--st-danger)] text-white hover:bg-[var(--st-danger)]/90"
          >
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  busy: boolean;
  onConfirm: () => void;
}

export function BookingBulkDeleteDialog({
  open,
  onOpenChange,
  count,
  busy,
  onConfirm,
}: BulkDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} booking{count === 1 ? '' : 's'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the selected bookings. This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={busy}
            className="bg-[var(--st-danger)] text-white hover:bg-[var(--st-danger)]/90"
          >
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
            Delete all
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
