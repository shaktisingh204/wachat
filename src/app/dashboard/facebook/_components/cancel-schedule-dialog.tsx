"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Button, useToast } from '@/components/sabcrm/20ui';
import {
  Loader2,
  XCircle } from "lucide-react";

import { handleDeletePost } from "@/app/actions/facebook.actions";

/**
 * Cancel-schedule alert dialog for Meta Suite scheduled posts.
 *
 * Server action: `handleDeletePost` (canceling a scheduled post on
 * Facebook is the same as deleting the unpublished post entity).
 */

import * as React from "react";

interface CancelScheduleDialogProps {
  postId: string;
  projectId: string;
  onCancelled: () => void;
  /** Optional label override; defaults to icon-only. */
  label?: string;
  /** Render mode for the trigger. */
  triggerVariant?: "ghost-icon" | "outline";
}

export function CancelScheduleDialog({
  postId,
  projectId,
  onCancelled,
  label,
  triggerVariant = "ghost-icon",
}: CancelScheduleDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToast();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await handleDeletePost(postId, projectId);
      if (result.success) {
        toast({
          title: "Schedule cancelled",
          description: "The post has been removed from the queue.",
        });
        setOpen(false);
        onCancelled();
      } else {
        toast({
          title: "Could not cancel",
          description: result.error ?? "Try again in a moment.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {triggerVariant === "outline" ? (
          <Button variant="outline" size="sm">
            <XCircle /> {label ?? "Cancel"}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cancel schedule"
          >
            <XCircle />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel scheduled post?</AlertDialogTitle>
          <AlertDialogDescription>
            The post will be removed from the queue and not be published. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={isPending}>
              Keep schedule
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <XCircle />}
              Cancel schedule
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
