'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Plus } from 'lucide-react';

import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Field, Input } from '@/components/sabcrm/20ui';
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
      <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
        New workbook
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workbook</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Field label="Workbook title" error={error ?? undefined}>
              <Input
                autoFocus
                placeholder="Q4 forecast"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={pending}>
              {pending ? 'Creating' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
