"use client";

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  Loader2,
  Save } from "lucide-react";

import { handleUpdatePost } from "@/app/actions/facebook.actions";
import type { FacebookPost } from "@/lib/definitions";

/**
 * Local zoru replacement for `@/components/zoruui-domain/update-post-dialog`.
 *
 * Same server action (`handleUpdatePost`); same hidden-form contract.
 */

import * as React from "react";

interface UpdatePostDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  post: FacebookPost;
  projectId: string;
  onPostUpdated: () => void;
}

export function UpdatePostDialog({
  isOpen,
  onOpenChange,
  post,
  projectId,
  onPostUpdated,
}: UpdatePostDialogProps) {
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);

  const handleAction = (formData: FormData) => {
    startTransition(async () => {
      const result = await handleUpdatePost(
        { success: false, error: undefined },
        formData,
      );
      if (result.success) {
        toast({ title: "Success", description: "Post updated." });
        onOpenChange(false);
        onPostUpdated();
      } else if (result.error) {
        toast({
          title: "Could not update post",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form action={handleAction} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="postId" value={post.id} />
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
            <DialogDescription>
              Edit the message of your post. Media attachments cannot be
              changed after publishing.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                className="min-h-40"
                defaultValue={post.message || ""}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
