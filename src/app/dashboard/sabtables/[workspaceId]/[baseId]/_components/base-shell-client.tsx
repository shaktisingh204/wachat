'use client';

/**
 * Persistent shell around the base. Top bar with base name plus a tables
 * "tab strip" (rendered as segmented links, since the design policy forbids
 * tab primitives here). Children render the current table view.
 */

import { useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Database } from 'lucide-react';

import {
  Button,
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
    <div className="min-h-screen flex flex-col">
      <div className="border-b border-[var(--st-border)] px-4 py-2 flex items-center gap-3">
        <Link
          href={`/dashboard/sabtables/${workspaceId}`}
          className="inline-flex items-center text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
        >
          <ChevronLeft className="w-4 h-4 mr-1" aria-hidden="true" />
          <span className="hidden sm:inline">Workspace</span>
        </Link>
        <div className="flex items-center gap-2 font-semibold text-[var(--st-text)]">
          <div
            className="w-6 h-6 rounded-[var(--st-radius)] flex items-center justify-center text-[var(--st-bg-secondary)]"
            style={{ backgroundColor: base.color || 'var(--st-text)' }}
          >
            <Database className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          {base.name}
        </div>
      </div>

      <div className="border-b border-[var(--st-border)] px-4 flex items-center gap-1 overflow-x-auto">
        {tables.map((t) => {
          const active = t._id === activeTableId;
          return (
            <Link
              key={t._id}
              href={`/dashboard/sabtables/${workspaceId}/${base._id}/${t._id}`}
              className={cn(
                'px-3 py-2 text-sm border-b-2 -mb-px transition whitespace-nowrap',
                active
                  ? 'border-[var(--st-accent)] text-[var(--st-text)] font-medium'
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
      </div>

      <div className="flex-1 min-h-0">{children}</div>

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
