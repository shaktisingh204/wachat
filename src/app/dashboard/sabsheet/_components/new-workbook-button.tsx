'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '@/components/sabcrm/20ui/compat';
import { createSabsheetWorkbook } from '@/app/actions/sabsheet.actions';

export function NewWorkbookButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const wb = await createSabsheetWorkbook({ title: title.trim() });
        setOpen(false);
        setTitle('');
        router.push(`/dashboard/sabsheet/${wb._id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create workbook');
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New workbook</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workbook</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="sabsheet-title">Workbook title</Label>
            <Input
              id="sabsheet-title"
              autoFocus
              placeholder="e.g. Q4 forecast"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
            {error ? <p className="text-sm text-[var(--st-text)]">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
