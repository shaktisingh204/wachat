
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { FacebookPost } from '@/lib/definitions';
import { handleUpdatePost } from '@/app/actions/facebook.actions';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Changes
    </Button>
  );
}

interface UpdatePostDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  post: FacebookPost;
  projectId: string;
  onPostUpdated: () => void;
}

export function UpdatePostDialog({ isOpen, onOpenChange, post, projectId, onPostUpdated }: UpdatePostDialogProps) {
  const [state, formAction] = useActionState(handleUpdatePost, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast({ title: 'Success!', description: "Post updated successfully." });
      onOpenChange(false);
      onPostUpdated();
    }
    if (state.error) {
      toast({ title: 'Error Updating Post', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onOpenChange, onPostUpdated]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="postId" value={post.id} />
          <DialogHeader>
            <DialogTitle>Update Post</DialogTitle>
            <DialogDescription>
              Edit the text content of your Facebook post. Media cannot be changed after posting.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="message">Post Message</Label>
              <Textarea
                id="message"
                name="message"
                className="min-h-40"
                defaultValue={post.message || ''}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
