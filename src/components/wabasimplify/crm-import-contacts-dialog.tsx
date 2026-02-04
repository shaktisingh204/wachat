

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
import { LoaderCircle, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { importCrmContacts } from '@/app/actions/crm.actions';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Import Contacts
    </Button>
  );
}

interface CrmImportContactsDialogProps {
  onImported: () => void;
}

export function CrmImportContactsDialog({ onImported }: CrmImportContactsDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(importCrmContacts, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setOpen(false);
      onImported();
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onImported]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Import Contacts</DialogTitle>
            <DialogDescription>
              Upload a CSV or XLSX file. Ensure columns match: `name`, `email`, `phone`, `company`, `jobTitle`, `status`, `leadScore`.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactFile">File</Label>
                <Input id="contactFile" name="contactFile" type="file" accept=".csv,.xlsx" required />
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
