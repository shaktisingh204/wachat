
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, UploadCloud } from 'lucide-react';
import { handleAddVideoThumbnail } from '@/app/actions/facebook.actions';
import { useToast } from '@/hooks/use-toast';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
      Upload Thumbnail
    </Button>
  );
}

interface AddThumbnailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
  projectId: string;
  onSuccess: () => void;
}

export function AddThumbnailDialog({ isOpen, onOpenChange, videoId, projectId, onSuccess }: AddThumbnailDialogProps) {
  const [state, formAction] = useActionState(handleAddVideoThumbnail, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast({ title: 'Success!', description: 'Video thumbnail uploaded successfully.' });
      onOpenChange(false);
      onSuccess();
    }
    if (state.error) {
      toast({ title: 'Error Updating Thumbnail', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onOpenChange, onSuccess]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="videoId" value={videoId} />
          <DialogHeader>
            <DialogTitle>Add Video Thumbnail</DialogTitle>
            <DialogDescription>
              Upload a custom thumbnail image for your video.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="thumbnailFile">Thumbnail Image</Label>
              <Input
                id="thumbnailFile"
                name="thumbnailFile"
                type="file"
                accept="image/jpeg,image/png"
                required
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
