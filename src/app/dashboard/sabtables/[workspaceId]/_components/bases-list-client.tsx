'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Database, Plus, ChevronLeft } from 'lucide-react';

import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Field,
  Input,
  Textarea,
  PageHeader,
  PageTitle,
  PageDescription,
  PageActions,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { createSabtablesBase } from '@/app/actions/sabtables.actions';
import type { SabtablesBaseDoc } from '@/lib/rust-client/sabtables-bases';
import type { SabtablesWorkspaceDoc } from '@/lib/rust-client/sabtables-workspaces';

interface Props {
  workspace: SabtablesWorkspaceDoc;
  initialItems: SabtablesBaseDoc[];
}

export function BasesListClient({ workspace, initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const res = await createSabtablesBase({
          workspaceId: workspace._id,
          name: name.trim(),
          description: description.trim() || undefined,
        });
        setItems((prev) => [res.entity, ...prev]);
        setOpen(false);
        setName('');
        setDescription('');
        router.refresh();
      } catch (err) {
        console.error('[sabtables] createBase failed', err);
      }
    });
  };

  return (
    <div className="px-6 py-8 space-y-8">
      <Link
        href="/dashboard/sabtables"
        className="inline-flex items-center text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
      >
        <ChevronLeft className="w-4 h-4 mr-1" aria-hidden="true" /> All workspaces
      </Link>

      <PageHeader>
        <div>
          <PageTitle>{workspace.name}</PageTitle>
          {workspace.description ? (
            <PageDescription>{workspace.description}</PageDescription>
          ) : null}
        </div>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
            New base
          </Button>
        </PageActions>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No bases yet"
          description="A base groups related tables, like a spreadsheet file containing several sheets."
          action={
            <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
              Create base
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((b) => (
            <Link key={b._id} href={`/dashboard/sabtables/${workspace._id}/${b._id}`}>
              <Card variant="interactive" padding="md" className="cursor-pointer h-full">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-[var(--st-radius)] flex items-center justify-center text-[var(--st-bg-secondary)]"
                    style={{ backgroundColor: b.color || 'var(--st-text)' }}
                  >
                    <Database className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate text-[var(--st-text)]">{b.name}</div>
                    {b.description ? (
                      <div className="text-sm text-[var(--st-text-secondary)] line-clamp-2">
                        {b.description}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New base</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales pipeline"
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={pending}
              disabled={pending || !name.trim()}
            >
              {pending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
