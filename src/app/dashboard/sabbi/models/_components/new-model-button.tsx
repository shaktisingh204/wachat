'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { createModelAction } from '@/app/actions/sabbi-models.actions';
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

export function NewModelButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [collection, setCollection] = useState('');
  const [description, setDescription] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!collection.trim()) {
      setError('A base collection is required.');
      return;
    }
    startTransition(async () => {
      try {
        const res = await createModelAction({
          name: name.trim() || 'Untitled model',
          collection: collection.trim(),
          description: description.trim() || undefined,
          source: 'manual',
        });
        setOpen(false);
        setName('');
        setCollection('');
        setDescription('');
        router.push(`/dashboard/sabbi/models/${res.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create model');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>New model</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create semantic model</DialogTitle>
          <DialogDescription>
            A model names a base collection and a reusable vocabulary of measures
            and dimensions. Define metrics once; reuse them across charts,
            dashboards, and the AI copilot.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="m-name">Name</Label>
            <Input
              id="m-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sales pipeline"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="m-collection">Base collection</Label>
            <Input
              id="m-collection"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              placeholder="sabcrm_records"
              disabled={pending}
            />
            <p className="text-xs text-[var(--st-text-secondary)]">
              The Mongo collection this model reads from. Connectors (P2) seed
              this for you.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="m-desc">Description (optional)</Label>
            <Textarea
              id="m-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              disabled={pending}
            />
          </div>
          {error && <p className="text-sm text-[var(--st-danger)]">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Creating…' : 'Create model'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
