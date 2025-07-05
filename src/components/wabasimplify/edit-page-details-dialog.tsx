'use client';

import { useActionState, useEffect, useRef } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FacebookPageDetails } from '@/lib/definitions';
import { handleUpdatePageDetails } from '@/app/actions/facebook.actions';
import { ScrollArea } from '../ui/scroll-area';

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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="pageId" value={pageDetails.id} />
          <DialogHeader>
            <DialogTitle>Edit Page Details</DialogTitle>
            <DialogDescription>
              Update information for your page "{pageDetails.name}". Changes may take time to appear.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] -mx-6 my-4 px-6">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="about">About</Label>
                <Textarea id="about" name="about" defaultValue={pageDetails.about || ''} className="min-h-32" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" name="phone" defaultValue={pageDetails.phone || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" name="website" type="url" defaultValue={pageDetails.website || ''} />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
