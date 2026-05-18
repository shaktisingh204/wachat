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
  ZoruAlertDialogTrigger,
  ZoruButton,
  useZoruToast,
} from '@/components/zoruui';
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
  const { toast } = useZoruToast();

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
    <ZoruAlertDialog open={open} onOpenChange={setOpen}>
      <ZoruAlertDialogTrigger asChild>
        {triggerVariant === "outline" ? (
          <ZoruButton variant="outline" size="sm">
            <XCircle /> {label ?? "Cancel"}
          </ZoruButton>
        ) : (
          <ZoruButton
            variant="ghost"
            size="icon-sm"
            aria-label="Cancel schedule"
          >
            <XCircle />
          </ZoruButton>
        )}
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Cancel scheduled post?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            The post will be removed from the queue and not be published. This
            action cannot be undone.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel asChild>
            <ZoruButton variant="outline" disabled={isPending}>
              Keep schedule
            </ZoruButton>
          </ZoruAlertDialogCancel>
          <ZoruAlertDialogAction asChild>
            <ZoruButton
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <XCircle />}
              Cancel schedule
            </ZoruButton>
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}
