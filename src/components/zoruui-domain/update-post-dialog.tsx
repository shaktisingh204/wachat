'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Button,
  Label,
  Textarea,
} from '@/components/zoruui';
import {
  useEffect,
  useRef,
  useState,
  useTransition } from 'react';

import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { FacebookPost } from '@/lib/definitions';
import { handleUpdatePost } from '@/app/actions/facebook.actions';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button type="submit" disabled={isPending}>
      {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
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
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  
  const action = (formData: FormData) => {
    startTransition(async () => {
        const result = await handleUpdatePost(null as any, formData);
        setState(result);
    });
  };

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
      <ZoruDialogContent className="sm:max-w-lg">
        <form action={action} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="postId" value={post.id} />
          <ZoruDialogHeader>
            <ZoruDialogTitle>Update Post</ZoruDialogTitle>
            <ZoruDialogDescription>
              Edit the text content of your Facebook post. Media cannot be changed after posting.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

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
          <ZoruDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
                {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
