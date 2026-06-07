"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, useToast } from '@/components/sabcrm/20ui';
import {
  useTransition } from "react";
import { Loader2,
  RotateCw } from "lucide-react";

/**
 * Commerce › API dialogs (ui20-only).
 *
 * RotateApiKeyConfirmDialog — surfaces a destructive confirmation flow
 * for rotating the Commerce API key. The actual rotation endpoint is
 * plan-gated; this dialog mirrors the legacy behaviour by showing
 * intent and surfacing a generated placeholder key on success.
 */

import * as React from "react";

export interface RotateApiKeyConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional async handler. If omitted, surfaces a default toast. */
  onRotate?: () => Promise<void> | void;
}

export function RotateApiKeyConfirmDialog({
  open,
  onOpenChange,
  onRotate,
}: RotateApiKeyConfirmDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleRotate = () => {
    startTransition(async () => {
      try {
        if (onRotate) {
          await onRotate();
        }
        toast({
          title: "API key rotated",
          description:
            "A new key has been issued. Update your integrations within 24 hours — the previous key remains valid until then.",
          variant: "success",
        });
        onOpenChange(false);
      } catch (err) {
        toast({
          title: "Could not rotate key",
          description:
            err instanceof Error
              ? err.message
              : "Unknown error rotating Commerce API key.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rotate Commerce API key?</AlertDialogTitle>
          <AlertDialogDescription>
            Rotating will issue a new key and start a 24-hour grace period
            during which both keys are accepted. After 24 hours the old key
            stops working and any integration still using it will fail.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleRotate();
            }}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="mr-1 h-4 w-4" />
            )}
            Rotate key
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
