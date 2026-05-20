'use client';

/**
 * HR Exits — list page.
 *
 * KPI strip: total · pending clearance · completed this month · avg notice days.
 * Bulk: approve clearance (status → complete), archive, delete with confirm.
 * Export: CSV.
 * Filters: status + type + search (preserved).
 */

import * as React from 'react';
import Link from 'next/link';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruCheckbox,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { Download, Edit, LoaderCircle, Plus, Trash2 } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  deleteExit,
  getExits,
  getExitKpis,
  bulkUpdateExitStatus,
  bulkDeleteExits,
  type ExitKpis,
} from '@/app/actions/crm-exits.actions';
import type {
  CrmExitDoc,
  CrmExitStatus,
  CrmExitType,
} from '@/lib/rust-client/crm-exits';

const BASE = '/dashboard/crm/hr/exits';

const STATUS_OPTIONS: Array<{ value: CrmExitStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS: Array<{ value: CrmExitType | 'all'; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'resignation', label: 'Resignation' },
  { value: 'termination', label: 'Termination' },
  { value: 'end_of_contract', label: 'End of contract' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'other', label: 'Other' },
];

const STATUS_TONE: Record<CrmExitStatus, StatusTone> = {
  open: 'amber',
  complete: 'green',
  cancelled: 'red',
  archived: 'neutral',
};

function pretty(s: string): string {
  return s.replace(/_/g, ' ');
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/* ─── KPI strip ─────────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: string | number;
  tone?: 'green' | 'amber' | 'blue' | 'neutral';
}

function KpiCard({ label, value, tone }: KpiCardProps) {
  const colors: Record<string, string> = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    blue: 'text-blue-600',
    neutral: 'text-zoru-ink',
  };
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-3">
      <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">{label}</span>
      <span className={`text-xl font-semibold tabular-nums ${colors[tone ?? 'neutral'] ?? ''}`}>
        {value}
      </span>
    </div>
  );
}

/* ─── Bulk bar ───────────────────────────────────────────────────────── */

type BulkAction = 'approveClearance' | 'archive' | 'delete';

interface BulkBarProps {
  count: number;
  pending: boolean;
  onAction: (action: BulkAction) => void;
  onClear: () => void;
}

function BulkBar({ count, pending, onAction, onClear }: BulkBarProps) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-2">
      <span className="text-[13px] text-zoru-ink-muted">{count} selected</span>
      <ZoruButton size="sm" variant="outline" disabled={pending} onClick={() => onAction('approveClearance')}>
        Approve clearance
      </ZoruButton>
      <ZoruButton size="sm" variant="outline" disabled={pending} onClick={() => onAction('archive')}>
        Archive
      </ZoruButton>
      <ZoruButton
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => onAction('delete')}
        className="text-destructive"
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
      </ZoruButton>
      <ZoruButton size="sm" variant="ghost" onClick={onClear}>
        Clear
      </ZoruButton>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function ExitsListPage() {
  const [exits, setExits] = React.useState<CrmExitDoc[]>([]);
  const [kpis, setKpis] = React.useState<ExitKpis | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<CrmExitStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = React.useState<CrmExitType | 'all'>('all');

  // Single-row delete
  const [pendingDelete, setPendingDelete] = React.useState<CrmExitDoc | null>(null);
  const [deletePending, startDeleteTransition] = React.useTransition();

  // Bulk
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = React.useTransition();
  const [bulkAction, setBulkAction] = React.useState<BulkAction | null>(null);

  const { toast } = useZoruToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [res, kpiData] = await Promise.all([
        getExits({
          q: search.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          type: typeFilter === 'all' ? undefined : typeFilter,
          limit: 100,
        }),
        getExitKpis(),
      ]);
      setExits(res.items ?? []);
      setKpis(kpiData);
    } catch {
      setExits([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, typeFilter]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh();
    }, 250);
    return () => window.clearTimeout(t);
  }, [refresh]);

  // Selection helpers
  const allIds = exits.map((e) => e._id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Single delete
  const handleDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    startDeleteTransition(async () => {
      const result = await deleteExit(id);
      if (result.success) {
        toast({ title: 'Exit deleted' });
        setPendingDelete(null);
        await refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Could not delete exit.',
          variant: 'destructive',
        });
      }
    });
  };

  // Bulk confirm / execute
  const executeBulk = (action: BulkAction) => {
    const ids = Array.from(selected);
    startBulkTransition(async () => {
      let result: { succeeded: number; failed: number };

      if (action === 'approveClearance') {
        result = await bulkUpdateExitStatus(ids, 'complete');
      } else if (action === 'archive') {
        result = await bulkUpdateExitStatus(ids, 'archived');
      } else {
        result = await bulkDeleteExits(ids);
      }

      const label = action === 'approveClearance' ? 'cleared' : action === 'archive' ? 'archived' : 'deleted';
      toast({
        title: `${result.succeeded} exit${result.succeeded !== 1 ? 's' : ''} ${label}`,
        description: result.failed > 0 ? `${result.failed} failed` : undefined,
        variant: result.failed > 0 ? 'destructive' : 'default',
      });

      setSelected(new Set());
      setBulkAction(null);
      await refresh();
    });
  };

  // Export CSV
  const handleExport = () => {
    const headers = ['Employee', 'Type', 'Notice start', 'Last day', 'F&F', 'NOC', 'Status'];
    const rows = exits.map((e) => ({
      Employee: e.employeeName ?? e.employeeId ?? '',
      Type: pretty(String(e.type ?? '')),
      'Notice start': fmtDate(e.noticeStart),
      'Last day': fmtDate(e.lastDay),
      'F&F': pretty(String(e.fnfStatus ?? '')),
      NOC: pretty(String(e.nocStatus ?? '')),
      Status: e.status ?? '',
    }));
    downloadCsv(`exits-${dateStamp()}.csv`, headers, rows);
  };

  const colSpan = 8; // checkbox + 6 data + actions

  return (
    <>
      <EntityListShell
        title="Exits"
        subtitle="Offboarding, resignations, F&F clearance and exit interviews."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New exit
              </Link>
            </ZoruButton>
          </div>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search by employee…',
        }}
        filters={
          <>
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as CrmExitStatus | 'all')}
            >
              <ZoruSelectTrigger className="h-9 w-[160px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as CrmExitType | 'all')}
            >
              <ZoruSelectTrigger className="h-9 w-[180px]">
                <ZoruSelectValue placeholder="Type" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </>
        }
        loading={isLoading && exits.length === 0}
      >
        {/* KPI strip */}
        {kpis && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Total exits" value={kpis.total} />
            <KpiCard label="Pending clearance" value={kpis.pendingClearance} tone="amber" />
            <KpiCard label="Completed this month" value={kpis.completedThisMonth} tone="green" />
            <KpiCard label="Avg notice (days)" value={kpis.avgNoticeDays} tone="blue" />
          </div>
        )}

        {/* Bulk action bar */}
        <BulkBar
          count={selected.size}
          pending={bulkPending}
          onAction={(action) => {
            if (action === 'delete') {
              setBulkAction(action);
            } else {
              executeBulk(action);
            }
          }}
          onClear={() => setSelected(new Set())}
        />

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-10 px-3">
                  <ZoruCheckbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Last day</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">F&amp;F</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">NOC</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={colSpan} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : exits.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={colSpan}
                    className="h-24 text-center text-zoru-ink-muted"
                  >
                    No exits match this filter.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                exits.map((e) => {
                  const status = (e.status ?? 'open') as CrmExitStatus;
                  const tone = STATUS_TONE[status] ?? 'neutral';
                  const isChecked = selected.has(e._id);
                  return (
                    <ZoruTableRow
                      key={e._id}
                      className={`border-zoru-line ${isChecked ? 'bg-zoru-surface-active' : ''}`}
                    >
                      <ZoruTableCell className="px-3">
                        <ZoruCheckbox
                          checked={isChecked}
                          onCheckedChange={() => toggleOne(e._id)}
                          aria-label={`Select ${e.employeeName ?? e._id}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        <EntityRowLink
                          href={`${BASE}/${e._id}`}
                          label={e.employeeName || e.employeeId || '—'}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="capitalize text-zoru-ink">
                        {pretty(String(e.type ?? '—'))}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {fmtDate(e.lastDay)}
                      </ZoruTableCell>
                      <ZoruTableCell className="capitalize text-zoru-ink">
                        {pretty(String(e.fnfStatus ?? '—'))}
                      </ZoruTableCell>
                      <ZoruTableCell className="capitalize text-zoru-ink">
                        {pretty(String(e.nocStatus ?? '—'))}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill label={status} tone={tone} />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <ZoruButton variant="ghost" size="icon" asChild>
                          <Link href={`${BASE}/${e._id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </ZoruButton>
                        <ZoruButton
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingDelete(e)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </ZoruButton>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </EntityListShell>

      {/* Single delete dialog */}
      <ZoruAlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete exit?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This will hide the exit from the active list. Audit history is preserved.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
              {deletePending ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Bulk delete confirm dialog */}
      <ZoruAlertDialog
        open={bulkAction === 'delete'}
        onOpenChange={(o) => !o && setBulkAction(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete {selected.size} exit{selected.size !== 1 ? 's' : ''}?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              The selected exits will be removed from the active list. Audit history is preserved.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => executeBulk('delete')}
              disabled={bulkPending}
            >
              {bulkPending ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Indicate bulk operation in flight when !someSelected */}
      {bulkPending && !someSelected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10">
          <LoaderCircle className="h-8 w-8 animate-spin text-zoru-primary" />
        </div>
      )}
    </>
  );
}
