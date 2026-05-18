'use client';

import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FacebookPageDetails } from '@/lib/definitions';
import { handleUpdatePageDetails } from '@/app/actions/facebook.actions';
import { ScrollArea } from '../ui/scroll-area';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Changes
    </ZoruButton>
  );
}

interface EditPageDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  pageDetails: FacebookPageDetails;
  projectId: string;
  onSuccess: () => void;
}

export function EditPageDetailsDialog({ isOpen, onOpenChange, pageDetails, projectId, onSuccess }: EditPageDetailsDialogProps) {
  const [state, formAction] = useActionState(handleUpdatePageDetails, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast({ title: 'Success!', description: 'Page details updated successfully.' });
      onOpenChange(false);
      onSuccess();
    }
    if (state.error) {
      toast({ title: 'Error Updating Page', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onOpenChange, onSuccess]);

  return (
    <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="pageId" value={pageDetails.id} />
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle>Edit Page Details</ZoruDialogTitle>
            <ZoruDialogDescription>
              Update information for your page "{pageDetails.name}". Changes may take time to appear.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <ZoruLabel htmlFor="about">About</ZoruLabel>
                <ZoruTextarea id="about" name="about" defaultValue={pageDetails.about || ''} className="min-h-32" />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="phone">Phone Number</ZoruLabel>
                <ZoruInput id="phone" name="phone" defaultValue={pageDetails.phone || ''} />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="website">Website</ZoruLabel>
                <ZoruInput id="website" name="website" type="url" defaultValue={pageDetails.website || ''} />
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <ZoruButton type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
