'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Input, Label, Textarea } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, PlusCircle } from 'lucide-react';
import { addRandomizerPost } from '@/app/actions/facebook.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Project } from '@/lib/definitions';
import { SabFileUrlInput } from '@/components/sabfiles';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
      Add Post
    </Button>
  );
}

interface CreateRandomizerPostDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: WithId<Project>;
  onPostAdded: () => void;
}

export function CreateRandomizerPostDialog({ isOpen, onOpenChange, project, onPostAdded }: CreateRandomizerPostDialogProps) {
  const [state, formAction] = useActionState(addRandomizerPost, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (state.success) {
      toast({ title: 'Success!', description: 'Post added to the randomizer pool.' });
      onOpenChange(false);
      onPostAdded();
    }
    if (state.error) {
      toast({ title: 'Error Adding Post', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onOpenChange, onPostAdded]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      formRef.current?.reset();
      setImageUrl('');
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Add Post to Pool</DialogTitle>
            <DialogDescription>
              Create content that will be randomly selected for posting.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" name="message" placeholder="What's on your mind?" className="min-h-32" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                <SabFileUrlInput
                  id="imageUrl"
                  name="imageUrl"
                  accept="image"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={setImageUrl}
                />
                <p className="text-xs text-[var(--st-text-secondary)]">If provided, this post will be published as a photo post.</p>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
