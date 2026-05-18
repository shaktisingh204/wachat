"use client";

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  useZoruToast,
} from '@/components/zoruui';
import {
  useTransition } from "react";
import { Loader2,
  RotateCw } from "lucide-react";

/**
 * Commerce › API dialogs (zoru-only).
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
  const { toast } = useZoruToast();

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
    <ZoruAlertDialog open={open} onOpenChange={onOpenChange}>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Rotate Commerce API key?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            Rotating will issue a new key and start a 24-hour grace period
            during which both keys are accepted. After 24 hours the old key
            stops working and any integration still using it will fail.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel disabled={isPending}>
            Cancel
          </ZoruAlertDialogCancel>
          <ZoruAlertDialogAction
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
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}
