'use client';

/**
 * ImportContactsDialog (wachat-local, ZoruUI).
 *
 * Replaces @/components/wabasimplify/import-contacts-dialog. Same server
 * action (handleImportContacts), same form fields and CSV download
 * handler.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Download, FileUp, Loader2, Upload } from 'lucide-react';
import type { WithId } from 'mongodb';

import { handleImportContacts } from '@/app/actions/contact.actions';
import type { Project } from '@/lib/definitions';

import {
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  cn,
  useZoruToast,
} from '@/components/zoruui';

const initialState = {
  message: null as string | null,
  error: null as string | null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {pending ? 'Importing…' : 'Import contacts'}
    </ZoruButton>
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
  const { toast } = useZoruToast();
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
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="outline" size="md">
          <FileUp />
          Import
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="max-w-[520px] p-0">
        <form action={formAction as any} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input
            type="hidden"
            name="phoneNumberId"
            value={selectedPhoneNumberId}
          />

          <ZoruDialogHeader className="flex flex-row items-start gap-3 border-b border-zoru-line px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
              <FileUp className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <ZoruDialogTitle className="text-[16px] text-zoru-ink">
                Import contacts
              </ZoruDialogTitle>
              <ZoruDialogDescription className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Upload a CSV or XLSX file to add or update contacts. First
                column must be the phone number (WhatsApp ID); second should be
                the name.
              </ZoruDialogDescription>
            </div>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[11.5px] text-zoru-ink-muted">
                Associate with number
              </ZoruLabel>
              <ZoruSelect
                value={selectedPhoneNumberId}
                onValueChange={setSelectedPhoneNumberId}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Choose a number…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {(project?.phoneNumbers || []).map((phone) => (
                    <ZoruSelectItem key={phone.id} value={phone.id}>
                      {phone.display_phone_number} ({phone.verified_name})
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <ZoruLabel className="text-[11.5px] text-zoru-ink-muted">
                  Contact file{' '}
                  <span className="ml-1 text-zoru-danger">*</span>
                </ZoruLabel>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="inline-flex items-center gap-1 text-[11px] text-zoru-ink-muted transition-colors hover:text-zoru-ink"
                >
                  <Download className="h-3 w-3" />
                  Sample CSV
                </button>
              </div>

              <label
                className={cn(
                  'group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--zoru-radius-lg)] border-2 border-dashed px-4 py-8 text-center transition-colors',
                  fileName
                    ? 'border-zoru-ink bg-zoru-surface-2'
                    : 'border-zoru-line bg-zoru-surface hover:bg-zoru-surface-2',
                )}
              >
                <Upload
                  className={cn(
                    'h-6 w-6 transition-colors',
                    fileName ? 'text-zoru-ink' : 'text-zoru-ink-muted',
                  )}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-zoru-ink">
                    {fileName || 'Click to choose a file'}
                  </span>
                  <span className="text-[11px] text-zoru-ink-muted">
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

          <ZoruDialogFooter className="gap-2 border-t border-zoru-line px-6 py-4 sm:justify-end">
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
