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
  useEffect,
  useRef,
  useState,
  useTransition } from 'react';

import { LoaderCircle, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// import { importSmsContacts } from '@/app/actions/sms.actions';
const importSmsContacts: any = (...args: any[]) => ({ error: 'not implemented' });

const initialState = { message: null, error: null };

function SubmitButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <ZoruButton type="submit" disabled={isPending}>
      {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Import Contacts
    </ZoruButton>
  );
}

interface SmsImportContactsDialogProps {
  onImported: () => void;
}

export function SmsImportContactsDialog({ onImported }: SmsImportContactsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const action = (formData: FormData) => {
    startTransition(async () => {
      const result = await importSmsContacts(null, formData);
      setState(result);
    });
  };

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
        <form action={action} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle>Import SMS Contacts</ZoruDialogTitle>
            <ZoruDialogDescription>
              Upload a CSV or XLSX file. The first column must be 'phone' and the second 'name'. Include country code in phone numbers.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <ZoruLabel htmlFor="contactFile">File</ZoruLabel>
                <ZoruInput id="contactFile" name="contactFile" type="file" accept=".csv,.xlsx" required />
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <ZoruButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
            <ZoruButton type="submit" disabled={isPending}>
              {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Import Contacts
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
