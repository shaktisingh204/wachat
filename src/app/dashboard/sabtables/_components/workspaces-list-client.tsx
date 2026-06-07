'use client';

/**
 * SabTables - workspaces grid. 20ui primitives only.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers, Plus } from 'lucide-react';

import {
  Button,
  Card,
  ColorPicker,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Field,
  Input,
  PageHeader,
  PageTitle,
  PageDescription,
  PageActions,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { createSabtablesWorkspace } from '@/app/actions/sabtables.actions';
import type { SabtablesWorkspaceDoc } from '@/lib/rust-client/sabtables-workspaces';

interface Props {
  initialItems: SabtablesWorkspaceDoc[];
}

export function WorkspacesListClient({ initialItems }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#7c3aed');
  const [pending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const res = await createSabtablesWorkspace({ name: name.trim(), color });
        setItems((prev) => [res.entity, ...prev]);
        setOpen(false);
        setName('');
        toast.success('Workspace created');
        router.refresh();
      } catch (err) {
        console.error('[sabtables] createWorkspace failed', err);
        toast.error('Could not create workspace. Please try again.');
      }
    });
  };

  return (
    <div className="px-6 py-8 space-y-8">
      <PageHeader>
        <div>
          <PageTitle>SabTables</PageTitle>
          <PageDescription>
            Flexible databases. Group bases under workspaces and collaborate on records.
          </PageDescription>
        </div>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
            New workspace
          </Button>
        </PageActions>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No workspaces yet"
          description="Workspaces group bases. Create your first one to get started."
          action={
            <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
              Create workspace
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((w) => (
            <Link key={w._id} href={`/dashboard/sabtables/${w._id}`} className="block h-full">
              <Card variant="interactive" className="h-full cursor-pointer">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-[var(--st-radius)] flex items-center justify-center text-[var(--st-bg-secondary)]"
                    style={{ backgroundColor: w.color || 'var(--st-text)' }}
                  >
                    <Layers className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate text-[var(--st-text)]">{w.name}</div>
                    {w.description ? (
                      <div className="text-sm text-[var(--st-text-secondary)] line-clamp-2">
                        {w.description}
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
            <DialogTitle>New workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Marketing CRM"
              />
            </Field>
            <Field label="Accent colour">
              <ColorPicker value={color} onChange={setColor} />
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
