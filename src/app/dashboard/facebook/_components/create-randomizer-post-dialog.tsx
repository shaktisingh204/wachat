"use client";

/**
 * Local zoru replacement for
 * `@/components/wabasimplify/create-randomizer-post-dialog`.
 *
 * Same server action (`addRandomizerPost`); zoru atoms only.
 */

import * as React from "react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, PlusCircle } from "lucide-react";

import { addRandomizerPost } from "@/app/actions/facebook.actions";
import type { Project, WithId } from "@/lib/definitions";

import {
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from "@/components/zoruui";

const initialState = {
  success: false,
  error: undefined as string | undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <PlusCircle />}
      Add to pool
    </ZoruButton>
  );
}

interface CreateRandomizerPostDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: WithId<Project>;
  onPostAdded: () => void;
}

export function CreateRandomizerPostDialog({
  isOpen,
  onOpenChange,
  project,
  onPostAdded,
}: CreateRandomizerPostDialogProps) {
  const [state, formAction] = useActionState(
    addRandomizerPost as any,
    initialState as any,
  );
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast({ title: "Added", description: "Post added to randomizer pool." });
      onOpenChange(false);
      onPostAdded();
    }
    if (state?.error) {
      toast({
        title: "Could not add post",
        description: state.error,
        variant: "destructive",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleOpenChange = (open: boolean) => {
    if (!open) formRef.current?.reset();
    onOpenChange(open);
  };

  return (
    <ZoruDialog open={isOpen} onOpenChange={handleOpenChange}>
      <ZoruDialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef} className="flex flex-col gap-0">
          <input
            type="hidden"
            name="projectId"
            value={project._id.toString()}
          />
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add post to pool</ZoruDialogTitle>
            <ZoruDialogDescription>
              Posts in this pool are rotated automatically by the randomizer.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <ZoruLabel htmlFor="message">Message</ZoruLabel>
              <ZoruTextarea
                id="message"
                name="message"
                placeholder="What's on your mind?"
                className="min-h-32"
                required
              />
            </div>
            <div className="grid gap-2">
              <ZoruLabel htmlFor="imageUrl">Image URL (optional)</ZoruLabel>
              <ZoruInput
                id="imageUrl"
                name="imageUrl"
                type="url"
                placeholder="https://example.com/image.jpg"
              />
              <p className="text-[11px] text-zoru-ink-muted">
                If provided, this post will be published as a photo post.
              </p>
            </div>
          </div>

          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
