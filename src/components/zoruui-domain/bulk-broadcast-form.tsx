'use client';

import { Button, Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Input, Label, useToast } from '@/components/sabcrm/20ui/compat';
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
    <Button type="submit" disabled={pending || disabled}>
      {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
      Distribute &amp; send
    </Button>
  );
}

interface BulkBroadcastFormProps {
  sourceProjectName: string;
  targetProjects: WithId<Project>[];
}

export function BulkBroadcastForm({ targetProjects }: BulkBroadcastFormProps) {
  const [state, formAction] = useFormState(handleBulkBroadcast as any, initialState as any);
  const { toast } = useToast();
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
    <Card>
      <form action={formAction} ref={formRef}>
        <input
          type="hidden"
          name="projectIds"
          value={targetProjects.map((p) => p._id.toString()).join(',')}
        />
        <CardHeader>
          <CardTitle>Bulk Broadcast from File</CardTitle>
          <CardDescription>
            Upload a single contact file. The contacts will be evenly distributed and sent from
            all {targetProjects.length} selected project
            {targetProjects.length === 1 ? '' : 's'}.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="templateName">Template name</Label>
            <Input
              id="templateName"
              name="templateName"
              required
              placeholder="e.g. offer_update_v2"
            />
            <p className="text-xs text-[var(--st-text-secondary)]">
              This template must exist with the same name and language across all selected projects.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="language">Language code</Label>
            <Input
              id="language"
              name="language"
              required
              placeholder="e.g. en_US"
              defaultValue="en_US"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactFile">Contact file</Label>
            <Input
              id="contactFile"
              name="contactFile"
              type="file"
              required
              accept=".csv,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-[var(--st-text-secondary)]">
              A CSV or XLSX file. The first column must be the phone number.
            </p>
          </div>
        </CardBody>
        <CardFooter>
          <SubmitButton disabled={!file} />
        </CardFooter>
      </form>
    </Card>
  );
}
