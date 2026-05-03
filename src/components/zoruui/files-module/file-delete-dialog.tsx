"use client";

import * as React from "react";

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
} from "../alert-dialog";

import type { ZoruFileEntity } from "./types";

export interface ZoruFileDeleteDialogProps {
  /** Either a single file or a list (for bulk delete). `null` closes the dialog. */
  files: ZoruFileEntity[] | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (files: ZoruFileEntity[]) => void | Promise<void>;
}

export function ZoruFileDeleteDialog({
  files,
  onOpenChange,
  onConfirm,
}: ZoruFileDeleteDialogProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const open = !!files && files.length > 0;
  const count = files?.length ?? 0;

  const handleConfirm = async () => {
    if (!files) return;
    setSubmitting(true);
    try {
      await onConfirm(files);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ZoruAlertDialog open={open} onOpenChange={onOpenChange}>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>
            Delete {count === 1 ? "this file" : `${count} files`}?
          </ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            {count === 1 && files?.[0]
              ? `"${files[0].name}" will be removed permanently.`
              : "These files will be removed permanently. This action cannot be undone."}
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel disabled={submitting}>Cancel</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction
            destructive
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={submitting}
          >
            {submitting ? "Deleting…" : "Yes, delete"}
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}
