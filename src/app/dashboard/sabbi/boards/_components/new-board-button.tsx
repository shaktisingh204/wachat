'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { createBoardAction } from '@/app/actions/sabbi-boards.actions';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@/components/sabcrm/20ui';

export function NewBoardButton() {
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
        const res = await createBoardAction({
          name: name.trim() || 'Untitled board',
          description: description.trim() || undefined,
        });
        setOpen(false);
        setName('');
        setDescription('');
        router.push(`/dashboard/sabbi/boards/${res.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create board');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>New board</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create dashboard board</DialogTitle>
          <DialogDescription>
            A board is a grid of model-backed cards with a shared cross-filter bar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="b-name">Name</Label>
            <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Revenue overview" disabled={pending} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-desc">Description (optional)</Label>
            <Textarea id="b-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={pending} />
          </div>
          {error && <p className="text-sm text-[var(--st-danger)]">{error}</p>}
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
  );
}
