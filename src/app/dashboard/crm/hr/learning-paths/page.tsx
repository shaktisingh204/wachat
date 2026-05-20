'use client';

/**
 * Learning paths — list page.
 *
 * KPI strip: Total · Active · Avg steps · Total est. hours.
 * Filter row: search by title/category, category, difficulty, status.
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
  getLearningPaths,
  deleteLearningPath,
  bulkArchiveLearningPaths,
  bulkDeleteLearningPaths,
  type CrmLearningPathDoc,
  type CrmLearningPathStatus,
} from '@/app/actions/crm-learning-paths.actions';

const BASE = '/dashboard/crm/hr/learning-paths';

const DIFFICULTY_OPTIONS = [
  { value: 'all', label: 'All difficulties' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const STATUS_OPTIONS: Array<{ value: CrmLearningPathStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

type Row = CrmLearningPathDoc & {
  category?: string;
  difficulty?: string;
  estimatedHours?: number;
  steps?: unknown[];
  prerequisites?: string;
  assigned_to?: string;
};

type BulkOp = 'archive' | 'delete';

/* ─── KPI strip ─────────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'green' | 'blue';
}

function KpiCard({ label, value, hint, tone }: KpiCardProps) {
  const cls = tone === 'green' ? 'text-green-600' : tone === 'blue' ? 'text-blue-600' : 'text-zoru-ink';
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-3">
      <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">{label}</span>
      <span className={`text-xl font-semibold tabular-nums ${cls}`}>{value}</span>
      {hint ? <span className="text-[11px] text-zoru-ink-muted">{hint}</span> : null}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function LearningPathsPage() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [diffFilter, setDiffFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState<CrmLearningPathStatus | 'all'>('all');

  const [pendingDelete, setPendingDelete] = React.useState<Row | null>(null);
  const [deletePending, startDelete] = React.useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkOp, setBulkOp] = React.useState<BulkOp | null>(null);
  const [bulkPending, startBulk] = React.useTransition();

  const { toast } = useZoruToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getLearningPaths({ limit: 200 });
      setRows(Array.isArray(res.items) ? (res.items as Row[]) : []);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = React.useMemo((): Row[] => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && String(r.status ?? '') !== statusFilter) return false;
      if (diffFilter !== 'all' && String(r.difficulty ?? '').toLowerCase() !== diffFilter) return false;
      if (q) {
        const hay = [r.name, r.category ?? '', r.description ?? ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, diffFilter]);

  const kpis = React.useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => String(r.status ?? '') === 'active').length;
    const totalSteps = rows.reduce((a, r) => a + (Array.isArray(r.steps) ? r.steps.length : 0), 0);
    const avgSteps = total ? Math.round(totalSteps / total) : 0;
    const totalHours = rows.reduce((a, r) => a + (Number(r.estimatedHours) || 0), 0);
    return { total, active, avgSteps, totalHours };
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
      const res = await deleteLearningPath(id);
      if (res.success) {
        toast({ title: 'Learning path deleted' });
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
        op === 'archive'
          ? await bulkArchiveLearningPaths(ids)
          : await bulkDeleteLearningPaths(ids);
      const verb = op === 'archive' ? 'archived' : 'deleted';
      toast({
        title: `${res.succeeded} path${res.succeeded !== 1 ? 's' : ''} ${verb}`,
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
      `learning-paths-${dateStamp()}.csv`,
      ['Title', 'Category', 'Difficulty', 'Steps', 'Est. hours', 'Status'],
      filtered.map((r) => ({
        Title: r.name,
        Category: r.category ?? '',
        Difficulty: r.difficulty ?? '',
        Steps: Array.isArray(r.steps) ? r.steps.length : 0,
        'Est. hours': r.estimatedHours ?? '',
        Status: r.status ?? '',
      })),
    );
  };

  return (
    <>
      <EntityListShell
        title="Learning paths"
        subtitle="Structured tracks with prerequisites, steps, and completion targets."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New path
              </Link>
            </ZoruButton>
          </div>
        }
        search={{ value: search, onChange: setSearch, placeholder: 'Search by title or category…' }}
        filters={
          <>
            <ZoruSelect value={diffFilter} onValueChange={setDiffFilter}>
              <ZoruSelectTrigger className="h-9 w-[180px]">
                <ZoruSelectValue placeholder="All difficulties" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {DIFFICULTY_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>{o.label}</ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect value={statusFilter} onValueChange={(v) => setStatusFilter(v as CrmLearningPathStatus | 'all')}>
              <ZoruSelectTrigger className="h-9 w-[160px]">
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
          <KpiCard label="Total paths" value={kpis.total} />
          <KpiCard label="Active" value={kpis.active} tone="green" />
          <KpiCard label="Avg steps" value={kpis.avgSteps} hint="Per path" />
          <KpiCard label="Total est. hours" value={kpis.totalHours} tone="blue" />
        </div>

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-10 px-3">
                  <ZoruCheckbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Difficulty</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Steps</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Est. hours</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={8} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : filtered.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={8} className="h-24 text-center text-zoru-ink-muted">
                    No learning paths match this filter.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((r) => {
                  const isChecked = selected.has(r._id);
                  const stepCount = Array.isArray(r.steps) ? r.steps.length : 0;
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
                        {r.category ? (
                          <span className="rounded bg-zoru-surface-2 px-2 py-0.5 text-[12px] capitalize">{r.category}</span>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="capitalize text-zoru-ink">
                        {r.difficulty ? (
                          <span className="rounded bg-zoru-surface-2 px-2 py-0.5 text-[12px] capitalize">{r.difficulty}</span>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="tabular-nums text-zoru-ink">{stepCount}</ZoruTableCell>
                      <ZoruTableCell className="tabular-nums text-zoru-ink">
                        {r.estimatedHours != null ? `${r.estimatedHours}h` : <span className="text-zoru-ink-muted">—</span>}
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
            <ZoruAlertDialogTitle>Delete learning path?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              &ldquo;{pendingDelete?.name}&rdquo; will be archived (soft-deleted).
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
              Delete {selected.size} path{selected.size !== 1 ? 's' : ''}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Selected learning paths will be archived (soft-deleted).
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
