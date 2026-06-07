'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Download, FileUp, Upload } from 'lucide-react';
import type { WithId } from 'mongodb';

import { handleImportContacts } from '@/app/actions/contact.actions';
import { useToast } from '@/hooks/use-toast';
import type { Project } from '@/lib/definitions';
import { cn } from '@/lib/utils';

/**
 * ImportContactsDialog - 20ui CSV/XLSX contact importer.
 */

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="md" loading={pending}>
      {pending ? 'Importing...' : 'Import contacts'}
    </Button>
  );
}

interface ImportContactsDialogProps {
  project: WithId<Project>;
  onImported: () => void;
}

export function ImportContactsDialog({
  project,
  onImported,
}: ImportContactsDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    handleImportContacts as any,
    initialState as any,
  );
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState(
    project.phoneNumbers?.[0]?.id || '',
  );
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success', description: state.message });
      formRef.current?.reset();
      setFileName(null);
      onImported();
      setOpen(false);
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, onImported]);

  const handleDownloadSample = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'phone,name\n' +
      '919876543210,John Doe\n' +
      '919876543211,Jane Smith';

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sample_contacts.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Sample file downloading...' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="md" iconLeft={FileUp}>
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[520px] p-0">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input
            type="hidden"
            name="phoneNumberId"
            value={selectedPhoneNumberId}
          />

          <DialogHeader className="flex flex-row items-start gap-3 border-b border-[var(--st-border)] px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
              <FileUp className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[16px] font-semibold leading-tight text-[var(--st-text)]">
                Import contacts
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[12px] leading-snug text-[var(--st-text-secondary)]">
                Upload a CSV or XLSX file to add or update contacts. First
                column must be the phone number (WhatsApp ID); second should be
                the name.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            {/* WhatsApp number */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="import-phone-number"
                className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]"
              >
                Associate with number
              </Label>
              <Select
                value={selectedPhoneNumberId}
                onValueChange={setSelectedPhoneNumberId}
              >
                <SelectTrigger
                  id="import-phone-number"
                  aria-label="Associate with number"
                >
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

            {/* File drop */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="contactFile"
                  required
                  className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]"
                >
                  Contact file
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  iconLeft={Download}
                  onClick={handleDownloadSample}
                >
                  Sample CSV
                </Button>
              </div>

              <label
                htmlFor="contactFile"
                className={cn(
                  'group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--st-radius)] border-2 border-dashed px-4 py-8 text-center transition-colors',
                  fileName
                    ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                    : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] hover:border-[var(--st-accent)]',
                )}
              >
                <Upload
                  className={cn(
                    'h-6 w-6 transition-colors',
                    fileName
                      ? 'text-[var(--st-text)]'
                      : 'text-[var(--st-text-secondary)]',
                  )}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-[var(--st-text)]">
                    {fileName || 'Click to choose a file'}
                  </span>
                  <span className="text-[11px] text-[var(--st-text-secondary)]">
                    {fileName ? 'Click to replace' : 'CSV or XLSX, up to 10 MB'}
                  </span>
                </div>
                <input
                  id="contactFile"
                  name="contactFile"
                  type="file"
                  accept=".csv,.xlsx"
                  required
                  className="sr-only"
                  onChange={(e) =>
                    setFileName(e.target.files?.[0]?.name ?? null)
                  }
                />
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-[var(--st-border)] px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
