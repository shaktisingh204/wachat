'use client';

/**
 * SabTables - workspaces grid. 20ui primitives only.
 */

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers, Plus, Database, ArrowUpRight, FolderKanban } from 'lucide-react';

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
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  StatCard,
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

  const describedCount = useMemo(
    () => items.filter((w) => Boolean(w.description?.trim())).length,
    [items],
  );

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
    <main className="mx-auto w-full max-w-[1200px] px-6 py-8 space-y-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabTables</PageEyebrow>
          <PageTitle>Workspaces</PageTitle>
          <PageDescription>
            Flexible databases without the spreadsheet limits. Group bases under
            workspaces and collaborate on records with your team.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
            New workspace
          </Button>
        </PageActions>
      </PageHeader>

      {items.length > 0 ? (
        <section
          aria-label="Workspace summary"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <StatCard
            label="Workspaces"
            value={items.length}
            icon={FolderKanban}
            accent="#7c3aed"
          />
          <StatCard label="Bases" value="Grouped" icon={Database} accent="#3b7af5" />
          <StatCard
            label="Described"
            value={describedCount}
            icon={Layers}
            accent="#1f9d55"
          />
        </section>
      ) : null}

      {items.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={Layers}
            title="No workspaces yet"
            description="Workspaces group related bases, like folders for your databases. Create your first one to get started."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
                Create workspace
              </Button>
            }
          />
        </Card>
      ) : (
        <section
          aria-label="Workspaces"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {items.map((w) => (
            <Link
              key={w._id}
              href={`/dashboard/sabtables/${w._id}`}
              className="group block h-full rounded-[var(--st-radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
            >
              <Card variant="interactive" className="h-full cursor-pointer">
                <article className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] text-[var(--st-bg-secondary)]"
                      style={{ backgroundColor: w.color || 'var(--st-text)' }}
                    >
                      <Layers className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 text-[var(--st-text-tertiary)] opacity-0 transition group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-[var(--st-text)]">
                      {w.name}
                    </h2>
                    <p className="mt-0.5 line-clamp-2 text-sm text-[var(--st-text-secondary)]">
                      {w.description?.trim() || 'Open to view and create bases.'}
                    </p>
                  </div>
                </article>
              </Card>
            </Link>
          ))}
        </section>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Name" help="Choose a name your team will recognise.">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Marketing CRM"
                autoFocus
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
              {pending ? 'Creating...' : 'Create workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
