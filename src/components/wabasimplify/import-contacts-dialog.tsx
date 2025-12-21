
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
import { LoaderCircle, FileUp } from 'lucide-react';
import { handleImportContacts } from '@/app/actions/contact.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
          Importing...
        </>
      ) : (
        'Import Contacts'
      )}
    </Button>
  );
}

interface ImportContactsDialogProps {
    project: WithId<Project>;
    onImported: () => void;
}

export function ImportContactsDialog({ project, onImported }: ImportContactsDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleImportContacts, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState(project.phoneNumbers?.[0]?.id || '');

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      onImported();
      setOpen(false);
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onImported]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
            <FileUp className="mr-2 h-4 w-4" />
            Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form action={formAction} ref={formRef}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <DialogHeader>
                <DialogTitle>Import Contacts</DialogTitle>
                <DialogDescription>
                    Upload a CSV or XLSX file to add or update contacts. The first column must be the phone number (WhatsApp ID) and the second should be the name.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                 <div className="space-y-2">
                    <Label htmlFor="phoneNumberId-import">Phone Number</Label>
                    <Select name="phoneNumberId" required value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                        <SelectTrigger id="phoneNumberId-import">
                            <SelectValue placeholder="Associate with number..." />
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
                    <Label htmlFor="contactFile">Contact File</Label>
                    <Input id="contactFile" name="contactFile" type="file" accept=".csv,.xlsx" required />
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
