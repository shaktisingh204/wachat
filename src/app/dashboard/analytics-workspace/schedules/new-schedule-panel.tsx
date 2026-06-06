'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { createScheduleAction } from '@/app/actions/analytics-bi.actions';
import type { BiScheduleFormat } from '@/lib/rust-client/bi-schedules';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';

interface WorkbookRef {
  id: string;
  name: string;
}

const FORMATS: BiScheduleFormat[] = ['pdf', 'csv', 'inline'];

export function NewSchedulePanel({ workbooks }: { workbooks: WorkbookRef[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [workbookId, setWorkbookId] = useState(workbooks[0]?.id ?? '');
  const [cron, setCron] = useState('0 9 * * MON');
  const [recipients, setRecipients] = useState('');
  const [format, setFormat] = useState<BiScheduleFormat>('pdf');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!name.trim() || !workbookId) {
      setError('Name and workbook are required');
      return;
    }
    startTransition(async () => {
      try {
        await createScheduleAction({
          name: name.trim(),
          workbookId,
          cron: cron.trim(),
          recipients: recipients
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
          format,
        });
        setName('');
        setRecipients('');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create schedule');
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New schedule</CardTitle>
        <CardDescription>
          Standard cron syntax (5 fields). Recipients are comma- or
          newline-separated email addresses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="sch-name">Name</Label>
            <Input
              id="sch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekly revenue digest"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Workbook</Label>
            <Select value={workbookId} onValueChange={setWorkbookId}>
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Pick a workbook" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {workbooks.map((w) => (
                  <ZoruSelectItem key={w.id} value={w.id}>
                    {w.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sch-cron">Cron</Label>
            <Input
              id="sch-cron"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              className="font-mono"
              placeholder="0 9 * * MON"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as BiScheduleFormat)}>
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {FORMATS.map((f) => (
                  <ZoruSelectItem key={f} value={f}>
                    {f}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="sch-rec">Recipients</Label>
            <Input
              id="sch-rec"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="alice@example.com, bob@example.com"
            />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-zoru-danger">{error}</p>}
        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Saving…' : 'Create schedule'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
