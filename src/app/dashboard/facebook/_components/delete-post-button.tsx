"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Button, useToast } from '@/components/sabcrm/20ui';
import {
  Loader2,
  Trash2 } from "lucide-react";

import { handleDeletePost } from "@/app/actions/facebook.actions";

/**
 * Local ui20 replacement for `@/components/20ui-domain/delete-post-button`.
 *
 * Same server action (`handleDeletePost`), confirmation via `AlertDialog`.
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
  const { toast } = useToast();

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
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {label ? (
          <Button variant="outline" size="sm">
            <Trash2 /> {label}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" aria-label="Delete post">
            <Trash2 />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this post?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The post will be permanently removed
            from Facebook and from your dashboard.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
