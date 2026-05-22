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
  Button,
  useZoruToast,
} from '@/components/zoruui';
import {
  Loader2,
  Trash2 } from "lucide-react";

import { handleDeletePost } from "@/app/actions/facebook.actions";

/**
 * Local zoru replacement for `@/components/wabasimplify/delete-post-button`.
 *
 * Same server action (`handleDeletePost`), confirmation via `ZoruAlertDialog`.
 */

import * as React from "react";

interface DeletePostButtonProps {
  postId: string;
  projectId: string;
  onPostDeleted: () => void;
  /** Optional label override; defaults to icon-only. */
  label?: string;
}

export function DeletePostButton({
  postId,
  projectId,
  onPostDeleted,
  label,
}: DeletePostButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useZoruToast();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await handleDeletePost(postId, projectId);
      if (result.success) {
        toast({ title: "Deleted", description: "Post removed." });
        setOpen(false);
        onPostDeleted();
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Could not delete post.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <ZoruAlertDialog open={open} onOpenChange={setOpen}>
      <ZoruAlertDialogTrigger asChild>
        {label ? (
          <Button variant="outline" size="sm">
            <Trash2 /> {label}
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="Delete post">
            <Trash2 />
          </Button>
        )}
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Delete this post?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            This action cannot be undone. The post will be permanently removed
            from Facebook and from your dashboard.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </ZoruAlertDialogCancel>
          <ZoruAlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete
            </Button>
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}
