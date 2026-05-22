'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Button,
  Input,
  Label,
  Textarea,
} from '@/components/zoruui';
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
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
      Add Post
    </ZoruButton>
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
    <ZoruDialog open={isOpen} onOpenChange={handleOpenChange}>
      <ZoruDialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle>Add Post to Pool</ZoruDialogTitle>
            <ZoruDialogDescription>
              Create content that will be randomly selected for posting.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <ZoruLabel htmlFor="message">Message</ZoruLabel>
                <ZoruTextarea id="message" name="message" placeholder="What's on your mind?" className="min-h-32" required />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="imageUrl">Image URL (Optional)</ZoruLabel>
                <SabFileUrlInput
                  id="imageUrl"
                  name="imageUrl"
                  accept="image"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={setImageUrl}
                />
                <p className="text-xs text-muted-foreground">If provided, this post will be published as a photo post.</p>
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <ZoruButton type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
