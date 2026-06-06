"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useTransition } from "react";
import { Loader2 } from "lucide-react";

import { unblockProfile } from "@/app/actions/facebook.actions";

/**
 * UnblockProfileDialog (Meta Suite local, zoru-only).
 *
 * Confirmation dialog for `unblockProfile` server action.
 */

import * as React from "react";

export interface UnblockProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string | null;
  profileName?: string | null;
  projectId: string;
  onUnblocked: () => void;
}

export function UnblockProfileDialog({
  open,
  onOpenChange,
  profileId,
  profileName,
  projectId,
  onUnblocked,
}: UnblockProfileDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleConfirm = () => {
    if (!profileId) return;
    startTransition(async () => {
      const result = await unblockProfile(profileId, projectId);
      if (result.error) {
        toast({
          title: "Couldn’t unblock profile",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Profile unblocked",
        description: `${profileName || profileId} can interact with your Page again.`,
        variant: "success",
      });
      onOpenChange(false);
      onUnblocked();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unblock this profile?</AlertDialogTitle>
          <AlertDialogDescription>
            {profileName || profileId} will be able to comment and message your
            Page again. You can re-block them at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : null}
            {isPending ? "Unblocking…" : "Unblock"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
