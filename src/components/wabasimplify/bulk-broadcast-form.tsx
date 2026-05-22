'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  useZoruToast,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useRef } from 'react';
import { useFormStatus,
  useFormState } from 'react-dom';
import { LoaderCircle } from 'lucide-react';

import type { WithId,
  Project } from '@/lib/definitions';
import { handleBulkBroadcast } from '@/app/actions/broadcast.actions';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending || disabled}>
      {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
      Distribute &amp; send
    </ZoruButton>
  );
}

interface BulkBroadcastFormProps {
  sourceProjectName: string;
  targetProjects: WithId<Project>[];
}

export function BulkBroadcastForm({ targetProjects }: BulkBroadcastFormProps) {
  const [state, formAction] = useFormState(handleBulkBroadcast as any, initialState as any);
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success', description: state.message });
      formRef.current?.reset();
      setFile(null);
    }
    if (state.error) {
      toast({
        title: 'Error starting broadcasts',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  return (
    <ZoruCard>
      <form action={formAction} ref={formRef}>
        <input
          type="hidden"
          name="projectIds"
          value={targetProjects.map((p) => p._id.toString()).join(',')}
        />
        <ZoruCardHeader>
          <ZoruCardTitle>Bulk Broadcast from File</ZoruCardTitle>
          <ZoruCardDescription>
            Upload a single contact file. The contacts will be evenly distributed and sent from
            all {targetProjects.length} selected project
            {targetProjects.length === 1 ? '' : 's'}.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <div className="space-y-2">
            <ZoruLabel htmlFor="templateName">Template name</ZoruLabel>
            <ZoruInput
              id="templateName"
              name="templateName"
              required
              placeholder="e.g. offer_update_v2"
            />
            <p className="text-xs text-zoru-ink-muted">
              This template must exist with the same name and language across all selected projects.
            </p>
          </div>
          <div className="space-y-2">
            <ZoruLabel htmlFor="language">Language code</ZoruLabel>
            <ZoruInput
              id="language"
              name="language"
              required
              placeholder="e.g. en_US"
              defaultValue="en_US"
            />
          </div>
          <div className="space-y-2">
            <ZoruLabel htmlFor="contactFile">Contact file</ZoruLabel>
            <ZoruInput
              id="contactFile"
              name="contactFile"
              type="file"
              required
              accept=".csv,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-zoru-ink-muted">
              A CSV or XLSX file. The first column must be the phone number.
            </p>
          </div>
        </ZoruCardContent>
        <ZoruCardFooter>
          <SubmitButton disabled={!file} />
        </ZoruCardFooter>
      </form>
    </ZoruCard>
  );
}
