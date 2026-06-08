'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Database, Plus, ChevronLeft, ArrowUpRight, Table2 } from 'lucide-react';

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
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  StatCard,
  EmptyState,
  useToast,
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
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pending, startTransition] = useTransition();

  const describedCount = items.filter((b) => Boolean(b.description?.trim())).length;

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
        toast.success('Base created');
        router.refresh();
      } catch (err) {
        console.error('[sabtables] createBase failed', err);
        toast.error('Could not create the base. Please try again.');
      }
    });
  };

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-8 space-y-6">
      <Link
        href="/dashboard/sabtables"
        className="inline-flex items-center rounded-[var(--st-radius-sm)] text-sm text-[var(--st-text-secondary)] transition hover:text-[var(--st-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
      >
        <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" /> All workspaces
      </Link>

      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Workspace</PageEyebrow>
          <PageTitle>{workspace.name}</PageTitle>
          <PageDescription>
            {workspace.description?.trim() ||
              'Bases group related tables, like a spreadsheet file with several sheets.'}
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
            New base
          </Button>
        </PageActions>
      </PageHeader>

      {items.length > 0 ? (
        <section
          aria-label="Base summary"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <StatCard
            label="Bases"
            value={items.length}
            icon={Database}
            accent="#3b7af5"
          />
          <StatCard label="Tables" value="Per base" icon={Table2} accent="#7c3aed" />
          <StatCard
            label="Described"
            value={describedCount}
            icon={Database}
            accent="#1f9d55"
          />
        </section>
      ) : null}

      {items.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={Database}
            title="No bases yet"
            description="A base groups related tables, like a spreadsheet file containing several sheets. Create your first one to start adding tables."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
                Create base
              </Button>
            }
          />
        </Card>
      ) : (
        <section
          aria-label="Bases"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {items.map((b) => (
            <Link
              key={b._id}
              href={`/dashboard/sabtables/${workspace._id}/${b._id}`}
              className="group block h-full rounded-[var(--st-radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
            >
              <Card variant="interactive" padding="md" className="h-full cursor-pointer">
                <article className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] text-[var(--st-bg-secondary)]"
                      style={{ backgroundColor: b.color || 'var(--st-text)' }}
                    >
                      <Database className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 text-[var(--st-text-tertiary)] opacity-0 transition group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-[var(--st-text)]">
                      {b.name}
                    </h2>
                    <p className="mt-0.5 line-clamp-2 text-sm text-[var(--st-text-secondary)]">
                      {b.description?.trim() || 'Open to view its tables and records.'}
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
            <DialogTitle>New base</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales pipeline"
                autoFocus
              />
            </Field>
            <Field label="Description" help="Optional. Explain what this base tracks.">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Deals, contacts, and follow-ups for the sales team."
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
              {pending ? 'Creating...' : 'Create base'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
