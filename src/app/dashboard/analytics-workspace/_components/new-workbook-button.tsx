'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { createWorkbookAction } from '@/app/actions/analytics-bi.actions';
import {
  Button,
  Dialog,
  Input,
  Label,
  Textarea,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from '@/components/sabcrm/20ui/compat';

export function NewWorkbookButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await createWorkbookAction({
          name: name.trim() || 'Untitled workbook',
          description: description.trim() || undefined,
          datasetIds: [],
          chartsJson: [],
        });
        setOpen(false);
        setName('');
        setDescription('');
        router.push(`/dashboard/analytics-workspace/workbooks/${res.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create workbook');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>New workbook</Button>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Create workbook</ZoruDialogTitle>
          <ZoruDialogDescription>
            Workbooks group datasets and charts. You can add both inside the editor.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="wb-name">Name</Label>
            <Input
              id="wb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q3 revenue review"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wb-desc">Description (optional)</Label>
            <Textarea
              id="wb-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={pending}
            />
          </div>
          {error && <p className="text-sm text-zoru-danger">{error}</p>}
        </div>
        <ZoruDialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Creating…' : 'Create'}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
