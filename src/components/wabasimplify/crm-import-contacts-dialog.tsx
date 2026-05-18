'use client';

import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { importCrmContacts } from '@/app/actions/crm.actions';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton
      type="submit"
      variant="obsidian"
      disabled={pending}
      leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
    >
      Import Contacts
    </ZoruButton>
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
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle className="text-foreground">Import Contacts</ZoruDialogTitle>
            <ZoruDialogDescription className="text-muted-foreground">
              Upload a CSV or XLSX file. Ensure columns match: `name`, `email`, `phone`, `company`, `jobTitle`, `status`, `leadScore`.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <ZoruLabel htmlFor="contactFile" className="text-foreground">File</ZoruLabel>
                <ZoruInput id="contactFile" name="contactFile" type="file" accept=".csv,.xlsx" required />
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <ZoruButton type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
