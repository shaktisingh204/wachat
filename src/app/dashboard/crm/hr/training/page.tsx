'use client';

/**
 * Training programs — list page.
 *
 * KPI strip: Active · Completed · Total hours · Avg duration.
 * Filter row: search by program name or trainer, training mode, status.
 * Bulk: archive, delete with confirm.
 * Export: CSV.
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
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  getTrainings,
  deleteTraining,
  bulkArchiveTrainings,
  bulkDeleteTrainings,
} from '@/app/actions/crm-training.actions';
import type {
  CrmTrainingDoc,
  CrmTrainingDeliveryMode,
  CrmTrainingStatus,
} from '@/lib/rust-client/crm-training';

const BASE = '/dashboard/crm/hr/training';

const MODE_OPTIONS: Array<{ value: CrmTrainingDeliveryMode | 'all'; label: string }> = [
  { value: 'all', label: 'All modes' },
  { value: 'online', label: 'Online' },
  { value: 'classroom', label: 'Classroom' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'self_paced', label: 'Self-paced' },
];

const STATUS_OPTIONS: Array<{ value: CrmTrainingStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'planned', label: 'Planned' },
  { value: 'open_for_enrollment', label: 'Open for enrollment' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
];

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/* ─── KPI strip ─────────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'green' | 'amber' | 'blue';
}

function KpiCard({ label, value, hint, tone }: KpiCardProps) {
  const colors: Record<string, string> = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    blue: 'text-blue-600',
  };
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-3">
      <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">{label}</span>
      <span className={`text-xl font-semibold tabular-nums ${tone ? colors[tone] : 'text-zoru-ink'}`}>
        {value}
      </span>
      {hint ? <span className="text-[11px] text-zoru-ink-muted">{hint}</span> : null}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

type Row = CrmTrainingDoc & { _id: string };
type BulkOp = 'archive' | 'delete';

export default function TrainingPage() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [modeFilter, setModeFilter] = React.useState<CrmTrainingDeliveryMode | 'all'>('all');
  const [statusFilter, setStatusFilter] = React.useState<CrmTrainingStatus | 'all'>('all');

  const [pendingDelete, setPendingDelete] = React.useState<Row | null>(null);
  const [deletePending, startDelete] = React.useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkOp, setBulkOp] = React.useState<BulkOp | null>(null);
  const [bulkPending, startBulk] = React.useTransition();

  const { toast } = useZoruToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getTrainings({ limit: 200 });
      setRows(Array.isArray(data.items) ? (data.items as Row[]) : []);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // Client-side filter
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && String(r.status ?? '') !== statusFilter) return false;
      if (modeFilter !== 'all' && String(r.deliveryMode ?? '') !== modeFilter) return false;
      if (q) {
        const hay = [r.name, r.trainerName ?? ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, modeFilter]);

  const kpis = React.useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => String(r.status ?? '') === 'completed').length;
    const active = rows.filter((r) => {
      const s = String(r.status ?? '');
      return s === 'in_progress' || s === 'open_for_enrollment' || s === 'planned';
    }).length;
    const totalHours = rows.reduce((a, r) => a + (Number(r.durationHours) || 0), 0);
    const avg = total ? Math.round(totalHours / total) : 0;
    return { active, completed, totalHours, avg };
  }, [rows]);

  // Selection
  const allIds = filtered.map((r) => r._id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Single delete
  const handleDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    startDelete(async () => {
      const res = await deleteTraining(id);
      if (res.success) {
        toast({ title: 'Program deleted' });
        setPendingDelete(null);
        await refresh();
      } else {
        toast({ title: 'Error', description: res.error ?? 'Could not delete.', variant: 'destructive' });
      }
    });
  };

  // Bulk execute
  const executeBulk = (op: BulkOp) => {
    const ids = Array.from(selected);
    startBulk(async () => {
      const res =
        op === 'archive' ? await bulkArchiveTrainings(ids) : await bulkDeleteTrainings(ids);
      const verb = op === 'archive' ? 'archived' : 'deleted';
      toast({
        title: `${res.succeeded} program${res.succeeded !== 1 ? 's' : ''} ${verb}`,
        variant: res.failed > 0 ? 'destructive' : 'default',
      });
      setSelected(new Set());
      setBulkOp(null);
      await refresh();
    });
  };

  // Export
  const handleExport = () => {
    downloadCsv(
      `training-${dateStamp()}.csv`,
      ['Program', 'Mode', 'Trainer', 'Start', 'End', 'Capacity', 'Hours', 'Status'],
      filtered.map((r) => ({
        Program: r.name,
        Mode: r.deliveryMode ?? '',
        Trainer: r.trainerName ?? '',
        Start: fmtDate(r.startDate),
        End: fmtDate(r.endDate),
        Capacity: r.maxParticipants ?? '',
        Hours: r.durationHours ?? '',
        Status: r.status ?? '',
      })),
    );
  };

  const colCount = 9; // checkbox + name + mode + trainer + start + end + capacity + hours + status + actions = 10

  return (
    <>
      <EntityListShell
        title="Training programs"
        subtitle="Online, classroom, and on-the-job learning sessions."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New program
              </Link>
            </ZoruButton>
          </div>
        }
        search={{ value: search, onChange: setSearch, placeholder: 'Search by name or trainer…' }}
        filters={
          <>
            <ZoruSelect value={modeFilter} onValueChange={(v) => setModeFilter(v as CrmTrainingDeliveryMode | 'all')}>
              <ZoruSelectTrigger className="h-9 w-[160px]">
                <ZoruSelectValue placeholder="All modes" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {MODE_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>{o.label}</ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect value={statusFilter} onValueChange={(v) => setStatusFilter(v as CrmTrainingStatus | 'all')}>
              <ZoruSelectTrigger className="h-9 w-[190px]">
                <ZoruSelectValue placeholder="All statuses" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>{o.label}</ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-2">
              <span className="text-[13px] text-zoru-ink-muted">{selected.size} selected</span>
              <ZoruButton size="sm" variant="outline" disabled={bulkPending} onClick={() => executeBulk('archive')}>
                Archive
              </ZoruButton>
              <ZoruButton size="sm" variant="outline" disabled={bulkPending} onClick={() => setBulkOp('delete')} className="text-destructive">
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </ZoruButton>
              <ZoruButton size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</ZoruButton>
            </div>
          ) : null
        }
        loading={isLoading && rows.length === 0}
      >
        {/* KPI strip */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Active" value={kpis.active} tone="blue" />
          <KpiCard label="Completed" value={kpis.completed} tone="green" />
          <KpiCard label="Total hours" value={kpis.totalHours} hint="Across all programs" />
          <KpiCard label="Avg duration" value={`${kpis.avg}h`} />
        </div>

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-10 px-3">
                  <ZoruCheckbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Program</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Mode</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Trainer</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Start</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">End</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Capacity</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Hours</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={colCount + 1} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : filtered.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={colCount + 1} className="h-24 text-center text-zoru-ink-muted">
                    No training programs match this filter.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((r) => {
                  const isChecked = selected.has(r._id);
                  return (
                    <ZoruTableRow key={r._id} className={`border-zoru-line ${isChecked ? 'bg-zoru-surface-active' : ''}`}>
                      <ZoruTableCell className="px-3">
                        <ZoruCheckbox
                          checked={isChecked}
                          onCheckedChange={() => toggleOne(r._id)}
                          aria-label={`Select ${r.name}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        <EntityRowLink href={`${BASE}/${r._id}`} label={r.name} />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {r.deliveryMode ? (
                          <span className="rounded bg-zoru-surface-2 px-2 py-0.5 text-[12px] capitalize">
                            {String(r.deliveryMode).replace(/_/g, ' ')}
                          </span>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{r.trainerName ?? '—'}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{fmtDate(r.startDate)}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{fmtDate(r.endDate)}</ZoruTableCell>
                      <ZoruTableCell className="tabular-nums text-zoru-ink">
                        {r.maxParticipants ?? '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="tabular-nums text-zoru-ink">
                        {r.durationHours != null ? `${r.durationHours}h` : '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill label={String(r.status ?? '')} tone={statusToTone(String(r.status ?? ''))} />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <ZoruButton variant="ghost" size="icon" asChild>
                          <Link href={`${BASE}/${r._id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </ZoruButton>
                        <ZoruButton variant="ghost" size="icon" onClick={() => setPendingDelete(r)}>
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

      {/* Single delete */}
      <ZoruAlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete program?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              &ldquo;{pendingDelete?.name}&rdquo; will be permanently deleted.
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

      {/* Bulk delete confirm */}
      <ZoruAlertDialog open={bulkOp === 'delete'} onOpenChange={(o) => !o && setBulkOp(null)}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete {selected.size} program{selected.size !== 1 ? 's' : ''}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Selected training programs will be permanently deleted.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={() => executeBulk('delete')} disabled={bulkPending}>
              {bulkPending ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
