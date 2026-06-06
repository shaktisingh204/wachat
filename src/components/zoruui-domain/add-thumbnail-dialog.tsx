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
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, UploadCloud, Upload } from 'lucide-react';
import { handleAddVideoThumbnail } from '@/app/actions/facebook.actions';
import { useToast } from '@/hooks/use-toast';
import { SabFilePickerButton } from '@/components/sabfiles';

const initialState = { success: false, error: undefined };

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled}>
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
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailName, setThumbnailName] = useState('');

  useEffect(() => {
    if (state.success) {
      toast({ title: 'Success!', description: 'Video thumbnail uploaded successfully.' });
      onOpenChange(false);
      onSuccess();
      setThumbnailUrl('');
      setThumbnailName('');
    }
    if (state.error) {
      toast({ title: 'Error Updating Thumbnail', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onOpenChange, onSuccess]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="videoId" value={videoId} />
          <input type="hidden" name="sourceUrl" value={thumbnailUrl} />
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add Video Thumbnail</ZoruDialogTitle>
            <ZoruDialogDescription>
              Pick a custom thumbnail image for your video from SabFiles.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="thumbnailFile">Thumbnail Image</Label>
              <div className="flex items-center gap-2">
                <SabFilePickerButton
                  accept="image"
                  onPick={({ url, name }) => {
                    setThumbnailUrl(url);
                    setThumbnailName(name);
                  }}
                >
                  <Upload className="h-4 w-4" /> Choose file
                </SabFilePickerButton>
                {thumbnailUrl && (
                  <span className="truncate text-xs text-zoru-ink-muted">
                    {thumbnailName || thumbnailUrl}
                  </span>
                )}
              </div>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton disabled={!thumbnailUrl} />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
