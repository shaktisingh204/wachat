'use client';

import {
  Button,
  Field,
  Modal,
  Select,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { Download,
  FileUp,
  Upload } from 'lucide-react';
import type { WithId } from 'mongodb';

import { handleImportContacts } from '@/app/actions/contact.actions';
import type { Project } from '@/lib/definitions';

/**
 * ImportContactsDialog (wachat-local, 20ui).
 *
 * Replaces the legacy import-contacts-dialog. Same server
 * action (handleImportContacts), same form fields and CSV download
 * handler.
 */

import * as React from 'react';

const initialState = {
  message: null as string | null,
  error: null as string | null,
};

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button
      type="submit"
      form="import-contacts-form"
      variant="primary"
      loading={pending}
      disabled={pending}
    >
      {pending ? 'Importing…' : 'Import contacts'}
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
  const [state, formAction, isPending] = useActionState(
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
      toast({ title: 'Success', description: state.message, tone: 'success' });
      formRef.current?.reset();
      setFileName(null);
      onImported();
      setOpen(false);
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        tone: 'danger',
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

  const phoneOptions = (project?.phoneNumbers || []).map((phone) => ({
    value: phone.id,
    label: `${phone.display_phone_number} (${phone.verified_name})`,
  }));

  const titleNode = (
    <span className="flex flex-row items-start gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)]"
      >
        <FileUp className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">Import contacts</span>
    </span>
  );

  return (
    <>
      <Button
        variant="outline"
        size="md"
        iconLeft={FileUp}
        onClick={() => setOpen(true)}
      >
        Import
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={titleNode}
        description="Upload a CSV or XLSX file to add or update contacts. First column must be the phone number (WhatsApp ID); second should be the name."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton pending={isPending} />
          </>
        }
      >
        <form action={formAction as any} ref={formRef} id="import-contacts-form">
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input
            type="hidden"
            name="phoneNumberId"
            value={selectedPhoneNumberId}
          />

          <div className="flex flex-col gap-5">
            <Field label="Associate with number">
              <Select
                value={selectedPhoneNumberId}
                onChange={(v) => setSelectedPhoneNumberId(v ?? '')}
                options={phoneOptions}
                placeholder="Choose a number…"
                aria-label="Associate with number"
              />
            </Field>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                  Contact file{' '}
                  <span className="ml-1 text-[var(--st-danger)]">*</span>
                </span>
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
                className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--st-radius-lg)] border-2 border-dashed px-4 py-8 text-center transition-colors"
                style={{
                  borderColor: fileName ? 'var(--st-text)' : 'var(--st-border)',
                  background: fileName ? 'var(--st-bg-muted)' : 'var(--st-bg)',
                }}
              >
                <Upload
                  className="h-6 w-6 transition-colors"
                  style={{
                    color: fileName ? 'var(--st-text)' : 'var(--st-text-secondary)',
                  }}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-[var(--st-text)]">
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
        </form>
      </Modal>
    </>
  );
}
