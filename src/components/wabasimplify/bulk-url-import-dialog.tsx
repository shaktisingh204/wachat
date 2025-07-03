
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
import { LoaderCircle, UploadCloud } from 'lucide-react';
import { handleBulkCreateShortUrls } from '@/app/actions/url-shortener.actions';
import { useToast } from '@/hooks/use-toast';

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
        'Import URLs'
      )}
    </Button>
  );
}

interface BulkImportDialogProps {
    projectId: string;
    onImportComplete: () => void;
}

export function BulkImportDialog({ projectId, onImportComplete }: BulkImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleBulkCreateShortUrls, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setOpen(false);
      onImportComplete();
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onImportComplete]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
            <UploadCloud className="mr-2 h-4 w-4" />
            Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
            <input type="hidden" name="projectId" value={projectId} />
            <DialogHeader>
                <DialogTitle>Bulk Import URLs</DialogTitle>
                <DialogDescription>
                    Upload a CSV or XLSX file. The first column should be the long URL, and the optional second column can be a custom alias.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="urlFile">File</Label>
                    <Input id="urlFile" name="urlFile" type="file" accept=".csv,.xlsx" required />
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
