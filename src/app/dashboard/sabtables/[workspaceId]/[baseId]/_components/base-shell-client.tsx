'use client';

/**
 * Persistent shell around the base — top bar with base name + tables
 * "tab strip" (we render as segmented buttons since ZoruUI policy
 * forbids tab primitives). Children render the current table view.
 */

import { useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Database } from 'lucide-react';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogFooter,
  Input,
  Label,
  cn,
} from '@/components/sabcrm/20ui/compat';
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
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b px-4 py-2 flex items-center gap-3">
        <Link
          href={`/dashboard/sabtables/${workspaceId}`}
          className="inline-flex items-center text-sm text-zoru-ink-muted hover:text-zoru-ink"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
          <span className="hidden sm:inline">Workspace</span>
        </Link>
        <div className="flex items-center gap-2 font-semibold">
          <div
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ backgroundColor: base.color || 'var(--zoru-ink)', color: 'var(--zoru-surface)' }}
          >
            <Database className="w-3.5 h-3.5" />
          </div>
          {base.name}
        </div>
      </div>

      <div className="border-b px-4 flex items-center gap-1 overflow-x-auto">
        {tables.map((t) => {
          const active = t._id === activeTableId;
          return (
            <Link
              key={t._id}
              href={`/dashboard/sabtables/${workspaceId}/${base._id}/${t._id}`}
              className={cn(
                'px-3 py-2 text-sm border-b-2 -mb-px transition whitespace-nowrap',
                active
                  ? 'border-primary text-zoru-ink font-medium'
                  : 'border-transparent text-zoru-ink-muted hover:text-zoru-ink',
              )}
            >
              {t.name}
            </Link>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className="ml-1"
        >
          <Plus className="w-4 h-4 mr-1" /> Add table
        </Button>
      </div>

      <div className="flex-1 min-h-0">{children}</div>

      <Dialog open={open} onOpenChange={setOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New table</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="tbl-name">Name</Label>
              <Input
                id="tbl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Contacts"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={pending || !name.trim()}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
