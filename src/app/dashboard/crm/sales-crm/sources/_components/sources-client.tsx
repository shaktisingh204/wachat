'use client';

import * as React from 'react';
import {
  Button,
  Input,
  Label,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { Download, ListChecks, Radio, Trash2, X } from 'lucide-react';
import { useTransition } from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RowDrawer } from '@/components/crm/row-drawer';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import {
  saveLeadSource,
  deleteLeadSource,
  bulkDeleteLeadSources,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadSource } from '@/lib/worksuite/crm-types';
import type { WithId } from 'mongodb';
import type { LeadSourceKpis } from '@/app/actions/worksuite/crm-plus.actions.types';

type Row = WithId<WsLeadSource> & { _id: string };

interface Props {
  rows: Row[];
  kpi: LeadSourceKpis;
}

function fmtDate(v?: string | Date | null): string {
  if (!v) return '—';
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/* ─── Inline edit form ──────────────────────────────────────────── */
function SourceEditForm({ row, onDone }: { row: Row; onDone: () => void }) {
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveLeadSource(undefined, fd);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Saved', description: 'Source updated.' });
        onDone();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="_id" value={row._id} />
      <div className="space-y-1.5">
        <Label htmlFor="src-name">Source Name</Label>
        <Input id="src-name" name="type" defaultValue={row.type} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="src-color">Color (hex)</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            id="src-color-picker"
            defaultValue={row.color ?? '#64748b'}
            className="h-8 w-10 cursor-pointer rounded border border-[var(--st-border)] bg-transparent"
            onChange={(e) => {
              const inp = document.getElementById('src-color-text') as HTMLInputElement | null;
              if (inp) inp.value = e.target.value;
            }}
          />
          <Input
            id="src-color-text"
            name="color"
            defaultValue={row.color ?? '#64748b'}
            placeholder="#64748b"
            className="font-mono text-[12px]"
          />
        </div>
      </div>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Saving…' : 'Save Changes'}
      </Button>
    </form>
  );
}

/* ─── Main client component ─────────────────────────────────────── */
export function SourcesClient({ rows: initialRows, kpi }: Props) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Row[]>(initialRows);
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [drawerRefresh, setDrawerRefresh] = React.useState(0);

  React.useEffect(() => { setRows(initialRows); }, [initialRows]);

  const filtered = rows.filter((r) =>
    r.type?.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r._id)));
    }
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteLeadSource(id);
      if (r.success) {
        setRows((prev) => prev.filter((x) => x._id !== id));
        toast({ title: 'Deleted', description: 'Source removed.' });
      } else {
        toast({ title: 'Error', description: r.error ?? 'Failed', variant: 'destructive' });
      }
    });
  }

  function handleBulkDelete() {
    const ids = [...selected];
    startTransition(async () => {
      const r = await bulkDeleteLeadSources(ids);
      if (r.success) {
        setRows((prev) => prev.filter((x) => !ids.includes(x._id)));
        setSelected(new Set());
        toast({ title: 'Deleted', description: `${r.processed} sources removed.` });
      } else {
        toast({ title: 'Error', description: r.error ?? 'Failed', variant: 'destructive' });
      }
    });
  }

  function handleExportCsv() {
    downloadCsv(`sources-${dateStamp()}.csv`, ['type', 'color', 'createdAt'], filtered.map((r) => ({
      type: r.type,
      color: r.color ?? '',
      createdAt: fmtDate(r.createdAt),
    })));
  }

  const allSelectedOnPage = filtered.length > 0 && selected.size === filtered.length;

  const bulkBar =
    selected.size > 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <div className="flex items-center gap-2 text-[var(--st-text)]">
          <ListChecks className="h-4 w-4 text-[var(--st-text)]" />
          {selected.size} selected
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={isPending}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    ) : null;

  const empty =
    filtered.length === 0 ? (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Radio className="h-8 w-8 text-[var(--st-text-secondary)]" strokeWidth={1.5} />
        <p className="text-[13px] text-[var(--st-text-secondary)]">
          {search ? 'No sources match your search.' : 'No sources yet.'}
        </p>
      </div>
    ) : undefined;

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Sources" value={kpi.total} icon={<Radio />} />
        <StatCard label="Sources with Leads" value={kpi.withActiveLeads} />
        <StatCard label="Top Source" value={kpi.topSource} />
        <StatCard label="Leads from Top Source" value={kpi.topSourceLeads} />
      </div>

      <EntityListShell
        title="Lead Sources"
        subtitle="Track where your leads come from (e.g. website, referral, ads)."
        search={{ value: search, onChange: setSearch, placeholder: 'Search sources…' }}
        primaryAction={
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        }
        bulkBar={bulkBar}
        empty={empty}
        loading={false}
      >
        <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={toggleAll}
                    aria-label="Select all"
                    className="rounded border-[var(--st-border)]"
                  />
                </ZoruTableHead>
                <ZoruTableHead>Source Name</ZoruTableHead>
                <ZoruTableHead>Color</ZoruTableHead>
                <ZoruTableHead>Created</ZoruTableHead>
                <ZoruTableHead className="w-24">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filtered.map((row) => {
                const color = row.color ?? '#64748b';
                return (
                  <ZoruTableRow key={row._id} data-selected={selected.has(row._id)}>
                    <ZoruTableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(row._id)}
                        onChange={() => toggleRow(row._id)}
                        aria-label={`Select ${row.type}`}
                        className="rounded border-[var(--st-border)]"
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="font-medium text-[var(--st-text)]">
                      <RowDrawer
                        label={row.type}
                        title="Edit Source"
                        description="Update source name and accent color."
                        key={`${row._id}-${drawerRefresh}`}
                      >
                        <SourceEditForm
                          row={row}
                          onDone={() => setDrawerRefresh((n) => n + 1)}
                        />
                      </RowDrawer>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="inline-block h-3 w-3 rounded-full border border-[var(--st-border)]"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-mono text-[11.5px] text-[var(--st-text-secondary)]">
                          {color}
                        </span>
                      </span>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12px] text-[var(--st-text-secondary)]">
                      {fmtDate(row.createdAt)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(row._id)}
                        disabled={isPending}
                        aria-label={`Delete ${row.type}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                      </Button>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })}
            </ZoruTableBody>
          </Table>
        </div>
      </EntityListShell>
    </div>
  );
}
