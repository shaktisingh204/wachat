'use client';

/**
 * Persistent shell around the base. Top bar with base name plus a tables
 * "tab strip" (rendered as segmented links, since the design policy forbids
 * tab primitives here). Children render the current table view.
 */

import { useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Database, Table2 } from 'lucide-react';

import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Field,
  Input,
  useToast,
  cn,
} from '@/components/sabcrm/20ui';
import { createSabtablesTable } from '@/app/actions/sabtables.actions';
import type { SabtablesBaseDoc } from '@/lib/rust-client/sabtables-bases';
import type { SabtablesTableDoc } from '@/lib/rust-client/sabtables-tables';

interface Props {
  workspaceId: string;
  base: SabtablesBaseDoc;
  tables: SabtablesTableDoc[];
  activeTableId: string | null;
  children: ReactNode;
}

export function BaseShellClient({
  workspaceId,
  base,
  tables,
  activeTableId,
  children,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const res = await createSabtablesTable(workspaceId, {
          baseId: base._id,
          name: name.trim(),
        });
        setOpen(false);
        setName('');
        router.push(`/dashboard/sabtables/${workspaceId}/${base._id}/${res.id}`);
        router.refresh();
      } catch (err) {
        console.error('[sabtables] createTable failed', err);
        toast.error('Could not create the table. Please try again.');
      }
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-2">
        <Link
          href={`/dashboard/sabtables/${workspaceId}`}
          className="inline-flex items-center rounded-[var(--st-radius-sm)] text-sm text-[var(--st-text-secondary)] transition hover:text-[var(--st-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
        >
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Workspace</span>
        </Link>
        <div className="flex items-center gap-2 font-semibold text-[var(--st-text)]">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-[var(--st-radius)] text-[var(--st-bg-secondary)]"
            style={{ backgroundColor: base.color || 'var(--st-text)' }}
          >
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          {base.name}
        </div>
        {tables.length > 0 ? (
          <Badge tone="neutral" kind="soft">
            <Table2 className="h-3 w-3" aria-hidden="true" />
            {tables.length} {tables.length === 1 ? 'table' : 'tables'}
          </Badge>
        ) : null}
      </header>

      <nav
        aria-label="Tables"
        className="flex items-center gap-1 overflow-x-auto border-b border-[var(--st-border)] bg-[var(--st-bg)] px-4"
      >
        {tables.map((t) => {
          const active = t._id === activeTableId;
          return (
            <Link
              key={t._id}
              href={`/dashboard/sabtables/${workspaceId}/${base._id}/${t._id}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]',
                active
                  ? 'border-[var(--st-accent)] font-medium text-[var(--st-text)]'
                  : 'border-transparent text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
              )}
            >
              {t.name}
            </Link>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          iconLeft={Plus}
          onClick={() => setOpen(true)}
          className="ml-1"
        >
          Add table
        </Button>
      </nav>

      <div className="min-h-0 flex-1">{children}</div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New table</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Contacts"
                autoFocus
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
              {pending ? 'Creating...' : 'Create table'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
