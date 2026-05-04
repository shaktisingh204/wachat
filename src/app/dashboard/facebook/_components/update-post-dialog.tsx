"use client";

/**
 * Local zoru replacement for `@/components/wabasimplify/update-post-dialog`.
 *
 * Same server action (`handleUpdatePost`); same hidden-form contract.
 */

import * as React from "react";
import { Loader2, Save } from "lucide-react";

import { handleUpdatePost } from "@/app/actions/facebook.actions";
import type { FacebookPost } from "@/lib/definitions";

import {
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from "@/components/zoruui";

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
  const { toast } = useZoruToast();
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
    <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-lg">
        <form action={handleAction} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="postId" value={post.id} />
          <ZoruDialogHeader>
            <ZoruDialogTitle>Edit post</ZoruDialogTitle>
            <ZoruDialogDescription>
              Edit the message of your post. Media attachments cannot be
              changed after publishing.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <ZoruLabel htmlFor="message">Message</ZoruLabel>
              <ZoruTextarea
                id="message"
                name="message"
                className="min-h-40"
                defaultValue={post.message || ""}
              />
            </div>
          </div>

          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </ZoruButton>
            <ZoruButton type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Save changes
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
