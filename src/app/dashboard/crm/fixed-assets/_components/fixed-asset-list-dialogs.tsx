'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
} from '@/components/sabcrm/20ui/compat';
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
    <ZoruAlertDialog open={open} onOpenChange={onOpenChange}>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Delete fixed asset?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            This permanently removes <strong>{label}</strong> from the
            database. The action cannot be undone.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel disabled={busy}>Cancel</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={busy}
            className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
          >
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
            Delete permanently
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
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
    <ZoruAlertDialog open={open} onOpenChange={onOpenChange}>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>
            Delete {count} asset{count === 1 ? '' : 's'}?
          </ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            This permanently removes the selected fixed assets. The action
            cannot be undone.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel disabled={busy}>Cancel</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={busy}
            className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
          >
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
            Delete all
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}
