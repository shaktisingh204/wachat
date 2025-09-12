
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, UserPlus } from 'lucide-react';
import { handleAddNewContact } from '@/app/actions/contact.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Project } from '@/lib/definitions';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Saving...
        </>
      ) : (
        'Add Contact'
      )}
    </Button>
  );
}

interface AddContactDialogProps {
    project: WithId<Project>;
    selectedPhoneNumberId: string;
}

export function AddContactDialog({ project, selectedPhoneNumberId }: AddContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleAddNewContact, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setOpen(false);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
    // Reset form state after processing, successful or not, to re-enable the button
    const form = formRef.current;
    if (form) {
        // This is a way to tell react-dom to reset the form state for the next submission
        form.requestSubmit(); 
    }
  }, [state, toast]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        formRef.current?.reset();
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={!selectedPhoneNumberId}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add New
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form action={formAction} ref={formRef}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="phoneNumberId" value={selectedPhoneNumberId} />
            <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
                <DialogDescription>
                    Manually add a contact to your list for the selected phone number.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" name="name" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="waId" className="text-right">WhatsApp ID</Label>
                    <Input id="waId" name="waId" placeholder="e.g. 15551234567" className="col-span-3" required />
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <SubmitButton />
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
