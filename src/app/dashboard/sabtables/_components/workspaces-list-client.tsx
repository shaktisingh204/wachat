'use client';

/**
 * SabTables — workspaces grid. ZoruUI primitives only.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers, Plus } from 'lucide-react';

import { Button, Card, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label, PageHeader, PageTitle, PageDescription, PageActions, EmptyState } from '@/components/sabcrm/20ui/compat';
import { createSabtablesWorkspace } from '@/app/actions/sabtables.actions';
import type { SabtablesWorkspaceDoc } from '@/lib/rust-client/sabtables-workspaces';

interface Props {
  initialItems: SabtablesWorkspaceDoc[];
}

export function WorkspacesListClient({ initialItems }: Props) {
  const router = useRouter();
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
        router.refresh();
      } catch (err) {
        console.error('[sabtables] createWorkspace failed', err);
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
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New workspace
          </Button>
        </PageActions>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-10 h-10" />}
          title="No workspaces yet"
          description="Workspaces group bases. Create your first one to get started."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create workspace
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((w) => (
            <Link key={w._id} href={`/dashboard/sabtables/${w._id}`}>
              <Card className="p-5 hover:shadow-md transition cursor-pointer h-full">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: w.color || 'var(--st-text)', color: 'var(--st-bg-secondary)' }}
                  >
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{w.name}</div>
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
            <div>
              <Label htmlFor="ws-name">Name</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Marketing CRM"
              />
            </div>
            <div>
              <Label htmlFor="ws-color">Accent colour</Label>
              <Input
                id="ws-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={pending || !name.trim()}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
