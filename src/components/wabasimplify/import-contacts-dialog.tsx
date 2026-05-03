'use client';

/**
 * ImportContactsDialog — Clay-styled CSV/XLSX contact importer.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LuDownload, LuFileUp, LuUpload, LuLoader } from 'react-icons/lu';
import type { WithId } from 'mongodb';

import { handleImportContacts } from '@/app/actions/contact.actions';
import { useToast } from '@/hooks/use-toast';
import type { Project } from '@/lib/definitions';

import { ClayButton } from '@/components/clay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ClayButton
      type="submit"
      variant="rose"
      size="md"
      disabled={pending}
      leading={
        pending ? (
          <LuLoader className="h-3.5 w-3.5 animate-spin" />
        ) : undefined
      }
    >
      {pending ? 'Importing…' : 'Import contacts'}
    </ClayButton>
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
    toast({ title: 'Sample file downloading…' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <ClayButton
          variant="pill"
          size="md"
          leading={<LuFileUp className="h-3.5 w-3.5" strokeWidth={2} />}
        >
          Import
        </ClayButton>
      </DialogTrigger>
      <DialogContent className="max-w-[520px] rounded-[18px] border border-border bg-card p-0 shadow-lg">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input
            type="hidden"
            name="phoneNumberId"
            value={selectedPhoneNumberId}
          />

          <DialogHeader className="flex flex-row items-start gap-3 border-b border-border px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-accent text-accent-foreground">
              <LuFileUp className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[16px] font-semibold text-foreground leading-tight">
                Import contacts
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[12px] text-muted-foreground leading-snug">
                Upload a CSV or XLSX file to add or update contacts. First
                column must be the phone number (WhatsApp ID); second should
                be the name.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            {/* WhatsApp number */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11.5px] font-semibold text-muted-foreground">
                Associate with number
              </Label>
              <Select
                value={selectedPhoneNumberId}
                onValueChange={setSelectedPhoneNumberId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a number…" />
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
                <Label className="text-[11.5px] font-semibold text-muted-foreground">
                  Contact file <span className="ml-1 text-destructive">*</span>
                </Label>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  <LuDownload className="h-3 w-3" strokeWidth={2} />
                  Sample CSV
                </button>
              </div>

              <label
                className={cn(
                  'group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed px-4 py-8 text-center transition-colors',
                  fileName
                    ? 'border-primary bg-accent/60'
                    : 'border-border bg-secondary hover:bg-muted',
                )}
              >
                <LuUpload
                  className={cn(
                    'h-6 w-6 transition-colors',
                    fileName ? 'text-accent-foreground' : 'text-muted-foreground',
                  )}
                  strokeWidth={1.75}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-foreground">
                    {fileName || 'Click to choose a file'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
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

          <DialogFooter className="border-t border-border px-6 py-4 sm:justify-end gap-2">
            <ClayButton
              type="button"
              variant="pill"
              size="md"
              onClick={() => setOpen(false)}
            >
              Cancel
            </ClayButton>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
