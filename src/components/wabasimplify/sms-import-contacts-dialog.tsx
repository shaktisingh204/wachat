
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
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
import { importSmsContacts } from '@/app/actions/sms.actions';

const initialState = { message: null, error: null };

function SubmitButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button type="submit" disabled={isPending}>
      {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Import Contacts
    </Button>
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={action} ref={formRef}>
            <DialogHeader>
                <DialogTitle>Import SMS Contacts</DialogTitle>
                <DialogDescription>
                   Upload a CSV or XLSX file. The first column must be 'phone' and the second 'name'. Include country code in phone numbers.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="contactFile">File</Label>
                    <Input id="contactFile" name="contactFile" type="file" accept=".csv,.xlsx" required />
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Import Contacts
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
