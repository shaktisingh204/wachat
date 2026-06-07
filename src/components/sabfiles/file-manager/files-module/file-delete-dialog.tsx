"use client";

import * as React from "react";

import {
  SabAlertDialog,
  SabAlertDialogAction,
  SabAlertDialogCancel,
  SabAlertDialogContent,
  SabAlertDialogDescription,
  SabAlertDialogFooter,
  SabAlertDialogHeader,
  SabAlertDialogTitle,
} from "@/components/sabcrm/20ui/composites/alert-dialog";

import type { SabFileEntity } from "./types";

export interface SabFileDeleteDialogProps {
  /** Either a single file or a list (for bulk delete). `null` closes the dialog. */
  files: SabFileEntity[] | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (files: SabFileEntity[]) => void | Promise<void>;
}

export function SabFileDeleteDialog({
  files,
  onOpenChange,
  onConfirm,
}: SabFileDeleteDialogProps) {
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
    <SabAlertDialog open={open} onOpenChange={onOpenChange}>
      <SabAlertDialogContent>
        <SabAlertDialogHeader>
          <SabAlertDialogTitle>
            Delete {count === 1 ? "this file" : `${count} files`}?
          </SabAlertDialogTitle>
          <SabAlertDialogDescription>
            {count === 1 && files?.[0]
              ? `"${files[0].name}" will be removed permanently.`
              : "These files will be removed permanently. This action cannot be undone."}
          </SabAlertDialogDescription>
        </SabAlertDialogHeader>
        <SabAlertDialogFooter>
          <SabAlertDialogCancel disabled={submitting}>Cancel</SabAlertDialogCancel>
          <SabAlertDialogAction
            destructive
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={submitting}
          >
            {submitting ? "Deleting…" : "Yes, delete"}
          </SabAlertDialogAction>
        </SabAlertDialogFooter>
      </SabAlertDialogContent>
    </SabAlertDialog>
  );
}
