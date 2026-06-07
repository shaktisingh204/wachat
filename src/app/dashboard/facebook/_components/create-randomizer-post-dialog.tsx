"use client";

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2,
  PlusCircle } from "lucide-react";

import { addRandomizerPost } from "@/app/actions/facebook.actions";
import type { Project,
  WithId } from "@/lib/definitions";

/**
 * Local zoru replacement for
 * `@/components/20ui-domain/create-randomizer-post-dialog`.
 *
 * Same server action (`addRandomizerPost`); zoru atoms only.
 */

import * as React from "react";

import { SabFileUrlInput } from "@/components/sabfiles";

const initialState = {
  success: false,
  error: undefined as string | undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <PlusCircle />}
      Add to pool
    </Button>
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
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (state?.success) {
      toast({ title: "Added", description: "Post added to randomizer pool." });
      setImageUrl("");
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
    if (!open) {
      formRef.current?.reset();
      setImageUrl("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef} className="flex flex-col gap-0">
          <input
            type="hidden"
            name="projectId"
            value={project._id.toString()}
          />
          <DialogHeader>
            <DialogTitle>Add post to pool</DialogTitle>
            <DialogDescription>
              Posts in this pool are rotated automatically by the randomizer.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                placeholder="What's on your mind?"
                className="min-h-32"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="imageUrl">Image URL (optional)</Label>
              <SabFileUrlInput
                id="imageUrl"
                name="imageUrl"
                accept="image"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={setImageUrl}
              />
              <p className="text-[11px] text-[var(--st-text-secondary)]">
                If provided, this post will be published as a photo post.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
