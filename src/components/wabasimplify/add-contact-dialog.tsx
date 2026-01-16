
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
import type { Project, Tag } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectCombobox } from './multi-select-combobox';

const initialState = {
  message: null,
  error: null,
  contactId: undefined,
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
    onAdded: () => void;
}

export function AddContactDialog({ project, onAdded }: AddContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleAddNewContact, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState(project.phoneNumbers?.[0]?.id || '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const hasRunEffectRef = useRef(false);

  useEffect(() => {
    // Only run if there's a new state from the action, and it hasn't been processed yet.
    if ((state.message || state.error) && !hasRunEffectRef.current) {
        if (state.message) {
          toast({ title: 'Success!', description: state.message });
          formRef.current?.reset();
          onAdded();
          setOpen(false);
        }
        if (state.error) {
          toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
        hasRunEffectRef.current = true;
    }
  }, [state, toast, onAdded]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        formRef.current?.reset();
        setSelectedTagIds([]);
        // Reset the flag when closing, so the effect can run on the next submission.
        hasRunEffectRef.current = false;
    }
    setOpen(isOpen);
  };
  
  const wrappedFormAction = (formData: FormData) => {
      // Reset the flag before dispatching the action.
      hasRunEffectRef.current = false;
      formAction(formData);
  };
  
  const tagOptions = (project.tags || []).map((tag: Tag) => ({ value: tag._id.toString(), label: tag.name, color: tag.color }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Add New
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={wrappedFormAction} ref={formRef}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="tagIds" value={selectedTagIds.join(',')} />
            <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
                <DialogDescription>
                    Manually add a contact to your list.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="phoneNumberId-dialog">Phone Number</Label>
                    <Select name="phoneNumberId" required value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                        <SelectTrigger id="phoneNumberId-dialog">
                            <SelectValue placeholder="Choose a number..." />
                        </SelectTrigger>
                        <SelectContent>
                            {(project?.phoneNumbers || []).map((phone) => (
                            <SelectItem key={phone.id} value={phone.id}>
                                {phone.display_phone_number} ({phone.verified_name})
                            </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="waId" className="text-right">WhatsApp ID</Label>
                    <Input id="waId" name="waId" placeholder="e.g. 15551234567" required />
                </div>
                 <div className="space-y-2">
                    <Label>Tags</Label>
                    <MultiSelectCombobox 
                        options={tagOptions}
                        selected={selectedTagIds}
                        onSelectionChange={setSelectedTagIds}
                        placeholder="Assign tags..."
                    />
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
                <SubmitButton />
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
