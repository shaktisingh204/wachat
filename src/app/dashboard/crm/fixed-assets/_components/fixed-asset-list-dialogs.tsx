'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/sabcrm/20ui';
import {
  LoaderCircle } from 'lucide-react';

/**
 * Delete confirmations used by the fixed-assets list — extracted out
 * of <FixedAssetListClient> to keep that file under 600 lines.
 */

import * as React from 'react';

interface SingleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  busy: boolean;
  onConfirm: () => void;
}

export function FixedAssetSingleDeleteDialog({
  open,
  onOpenChange,
  label,
  busy,
  onConfirm,
}: SingleProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete fixed asset?</AlertDialogTitle>
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

interface BulkProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  busy: boolean;
  onConfirm: () => void;
}

export function FixedAssetBulkDeleteDialog({
  open,
  onOpenChange,
  count,
  busy,
  onConfirm,
}: BulkProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} asset{count === 1 ? '' : 's'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the selected fixed assets. The action
            cannot be undone.
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
