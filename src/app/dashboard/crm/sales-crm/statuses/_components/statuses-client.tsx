'use client';

import * as React from 'react';
import {
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { Download, Flag, ListChecks, Trash2, X } from 'lucide-react';
import { useTransition } from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RowDrawer } from '@/components/crm/row-drawer';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import {
  saveLeadStatus,
  deleteLeadStatus,
  bulkDeleteLeadStatuses,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { LeadStatusKpis } from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadStatus } from '@/lib/worksuite/crm-types';
import type { WithId } from 'mongodb';

type Row = WithId<WsLeadStatus> & { _id: string };

interface Props {
  rows: Row[];
  kpi: LeadStatusKpis;
}

type TypeFilter = 'all' | 'open' | 'closed' | 'won-lost';

function fmtDate(v?: string | Date | null): string {
  if (!v) return '—';
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function classifyStatus(name: string): TypeFilter {
  const n = name.toLowerCase();
  if (['won', 'lost'].some((k) => n.includes(k))) return 'won-lost';
  if (['closed', 'converted', 'disqualified', 'dead'].some((k) => n.includes(k))) return 'closed';
  return 'open';
}

/* ─── Inline edit form ──────────────────────────────────────────── */
function StatusEditForm({ row, onDone }: { row: Row; onDone: () => void }) {
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveLeadStatus(undefined, fd);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Saved', description: 'Status updated.' });
        onDone();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="_id" value={row._id} />
      <div className="space-y-1.5">
        <ZoruLabel htmlFor="st-name">Status Name</ZoruLabel>
        <ZoruInput id="st-name" name="type" defaultValue={row.type} required />
      </div>
      <div className="space-y-1.5">
        <ZoruLabel htmlFor="st-color">Color (hex)</ZoruLabel>
        <div className="flex items-center gap-2">
          <input
            type="color"
            id="st-color-picker"
            defaultValue={row.color ?? '#64748b'}
            className="h-8 w-10 cursor-pointer rounded border border-zoru-line bg-transparent"
            onChange={(e) => {
              const inp = document.getElementById('st-color-text') as HTMLInputElement | null;
              if (inp) inp.value = e.target.value;
            }}
          />
          <ZoruInput
            id="st-color-text"
            name="color"
            defaultValue={row.color ?? '#64748b'}
            placeholder="#64748b"
            className="font-mono text-[12px]"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <ZoruLabel htmlFor="st-priority">Priority</ZoruLabel>
        <ZoruInput
          id="st-priority"
          name="priority"
          type="number"
          defaultValue={String(row.priority ?? 0)}
        />
      </div>
      <div className="space-y-1.5">
        <ZoruLabel htmlFor="st-default">Default Status</ZoruLabel>
        <ZoruSelect name="default" defaultValue={row.default ? 'yes' : 'no'}>
          <ZoruSelectTrigger id="st-default">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="no">No</ZoruSelectItem>
            <ZoruSelectItem value="yes">Yes</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>
      </div>
      <ZoruButton type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Saving…' : 'Save Changes'}
      </ZoruButton>
    </form>
  );
}

/* ─── Main client component ─────────────────────────────────────── */
export function StatusesClient({ rows: initialRows, kpi }: Props) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Row[]>(initialRows);
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [drawerRefresh, setDrawerRefresh] = React.useState(0);

  React.useEffect(() => { setRows(initialRows); }, [initialRows]);

  const filtered = rows.filter((r) => {
    const nameMatch = r.type?.toLowerCase().includes(search.toLowerCase());
    if (!nameMatch) return false;
    if (typeFilter === 'all') return true;
    return classifyStatus(r.type ?? '') === typeFilter;
  });

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
      const r = await deleteLeadStatus(id);
      if (r.success) {
        setRows((prev) => prev.filter((x) => x._id !== id));
        toast({ title: 'Deleted', description: 'Status removed.' });
      } else {
        toast({ title: 'Error', description: r.error ?? 'Failed', variant: 'destructive' });
      }
    });
  }

  function handleBulkDelete() {
    const ids = [...selected];
    startTransition(async () => {
      const r = await bulkDeleteLeadStatuses(ids);
      if (r.success) {
        setRows((prev) => prev.filter((x) => !ids.includes(x._id)));
        setSelected(new Set());
        toast({ title: 'Deleted', description: `${r.processed} statuses removed.` });
      } else {
        toast({ title: 'Error', description: r.error ?? 'Failed', variant: 'destructive' });
      }
    });
  }

  function handleExportCsv() {
    downloadCsv(`statuses-${dateStamp()}.csv`, ['type', 'color', 'priority', 'default', 'createdAt'], filtered.map((r) => ({
      type: r.type,
      color: r.color ?? '',
      priority: r.priority ?? 0,
      default: r.default ? 'Yes' : 'No',
      createdAt: fmtDate(r.createdAt),
    })));
  }

  const allSelectedOnPage = filtered.length > 0 && selected.size === filtered.length;

  const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'All types' },
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'won-lost', label: 'Won / Lost' },
  ];

  const filters = (
    <ZoruSelect value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
      <ZoruSelectTrigger className="h-9 w-40 text-[12.5px]">
        <ZoruSelectValue />
      </ZoruSelectTrigger>
      <ZoruSelectContent>
        {TYPE_FILTER_OPTIONS.map((o) => (
          <ZoruSelectItem key={o.value} value={o.value}>
            {o.label}
          </ZoruSelectItem>
        ))}
      </ZoruSelectContent>
    </ZoruSelect>
  );

  const bulkBar =
    selected.size > 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <div className="flex items-center gap-2 text-zoru-ink">
          <ListChecks className="h-4 w-4 text-zoru-primary" />
          {selected.size} selected
        </div>
        <div className="flex items-center gap-1">
          <ZoruButton size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </ZoruButton>
          <ZoruButton size="sm" variant="destructive" onClick={handleBulkDelete} disabled={isPending}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </ZoruButton>
          <ZoruButton size="sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X className="h-3.5 w-3.5" />
          </ZoruButton>
        </div>
      </div>
    ) : null;

  const empty =
    filtered.length === 0 ? (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Flag className="h-8 w-8 text-zoru-ink-muted" strokeWidth={1.5} />
        <p className="text-[13px] text-zoru-ink-muted">
          {search || typeFilter !== 'all' ? 'No statuses match your filters.' : 'No statuses yet.'}
        </p>
      </div>
    ) : undefined;

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ZoruStatCard label="Total Statuses" value={kpi.total} icon={<Flag />} />
        <ZoruStatCard label="Open Statuses" value={kpi.openCount} />
        <ZoruStatCard label="Closed Statuses" value={kpi.closedCount} />
        <ZoruStatCard label="Won / Lost" value={kpi.wonLostCount} />
      </div>

      <EntityListShell
        title="Lead Statuses"
        subtitle="Define the funnel stages a lead can move through."
        search={{ value: search, onChange: setSearch, placeholder: 'Search statuses…' }}
        filters={filters}
        primaryAction={
          <ZoruButton variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </ZoruButton>
        }
        bulkBar={bulkBar}
        empty={empty}
        loading={false}
      >
        <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={toggleAll}
                    aria-label="Select all"
                    className="rounded border-zoru-line"
                  />
                </ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Color</ZoruTableHead>
                <ZoruTableHead>Priority</ZoruTableHead>
                <ZoruTableHead>Default</ZoruTableHead>
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
                        className="rounded border-zoru-line"
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <RowDrawer
                        label={
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              aria-hidden
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span
                              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{ backgroundColor: `${color}22`, color }}
                            >
                              {row.type}
                            </span>
                          </span>
                        }
                        title="Edit Status"
                        description="Update status name, color, priority and default flag."
                        key={`${row._id}-${drawerRefresh}`}
                      >
                        <StatusEditForm
                          row={row}
                          onDone={() => setDrawerRefresh((n) => n + 1)}
                        />
                      </RowDrawer>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <span className="font-mono text-[11.5px] text-zoru-ink-muted">{color}</span>
                    </ZoruTableCell>
                    <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                      {row.priority ?? 0}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <span
                        className={
                          row.default
                            ? 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-800'
                            : 'text-[12px] text-zoru-ink-muted'
                        }
                      >
                        {row.default ? 'Yes' : 'No'}
                      </span>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                      {fmtDate(row.createdAt)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruButton
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(row._id)}
                        disabled={isPending}
                        aria-label={`Delete ${row.type}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-zoru-danger" />
                      </ZoruButton>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </EntityListShell>
    </div>
  );
}
