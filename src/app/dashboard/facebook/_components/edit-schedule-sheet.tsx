"use client";

import {
  Button,
  Label,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  format } from "date-fns";
import { CalendarClock,
  Loader2,
  Save } from "lucide-react";

import { handleUpdatePost } from "@/app/actions/facebook.actions";
import type { FacebookPost } from "@/lib/definitions";

/**
 * Edit-schedule sheet for Meta Suite scheduled posts.
 *
 * Server action: `handleUpdatePost` (Facebook Graph only allows the
 * message to be edited on an unpublished post — schedule time is shown
 * as read-only metadata; rescheduling requires deleting + recreating).
 */

import * as React from "react";

interface EditScheduleSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  post: FacebookPost;
  projectId: string;
  onPostUpdated: () => void;
}

export function EditScheduleSheet({
  isOpen,
  onOpenChange,
  post,
  projectId,
  onPostUpdated,
}: EditScheduleSheetProps) {
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useZoruToast();

  const scheduledAt = React.useMemo(() => {
    if (!post.scheduled_publish_time) return null;
    return new Date(post.scheduled_publish_time * 1000);
  }, [post.scheduled_publish_time]);

  const handleAction = (formData: FormData) => {
    startTransition(async () => {
      const result = await handleUpdatePost(
        { success: false, error: undefined },
        formData,
      );
      if (result.success) {
        toast({
          title: "Schedule updated",
          description: "The scheduled post has been edited.",
        });
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
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <ZoruSheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-md"
      >
        <form action={handleAction} className="flex h-full flex-col">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="postId" value={post.id} />

          <ZoruSheetHeader className="border-b border-zoru-line p-6">
            <ZoruSheetTitle>Edit scheduled post</ZoruSheetTitle>
            <ZoruSheetDescription>
              Adjust the message of this scheduled post. Rescheduling the
              publish time requires cancelling and recreating it.
            </ZoruSheetDescription>
          </ZoruSheetHeader>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <div className="flex items-start gap-3 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink-muted">
                <CalendarClock className="h-4 w-4" />
              </span>
              <div className="flex min-w-0 flex-col">
                <p className="text-[11px] uppercase tracking-wide text-zoru-ink-subtle">
                  Scheduled for
                </p>
                <p className="text-sm font-medium text-zoru-ink">
                  {scheduledAt
                    ? format(scheduledAt, "PPP 'at' p")
                    : "Not scheduled"}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="schedule-message">Message</Label>
              <Textarea
                id="schedule-message"
                name="message"
                rows={8}
                defaultValue={post.message ?? ""}
                placeholder="Edit the post message…"
                required
              />
              <p className="text-[11px] text-zoru-ink-subtle">
                Media attachments cannot be changed once a post is scheduled.
              </p>
            </div>
          </div>

          <ZoruSheetFooter className="border-t border-zoru-line p-4">
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
          </ZoruSheetFooter>
        </form>
      </ZoruSheetContent>
    </Sheet>
  );
}
