'use client';

/**
 * Succession Planning — list page.
 *
 * KPI strip: Active plans · Ready-now · Ready in 1yr · Ready in 2yr+ · Roles covered.
 * Filter row: search by employee/successor/role, readiness filter.
 * Bulk delete with confirm.
 * Export CSV.
 * EntityRowLink on role/employee name cell.
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
  ZoruBadge,
  useZoruToast,
} from '@/components/zoruui';
import { Download, Edit, LoaderCircle, Plus, Trash2, UserPlus } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  getCrmSuccessionPlans,
  deleteCrmSuccessionPlan,
  bulkDeleteCrmSuccessionPlans,
  type CrmSuccessionDoc,
  type SuccessionReadiness,
} from '@/app/actions/crm-succession.actions';

const BASE = '/dashboard/crm/hr/succession';

const READINESS_OPTIONS: Array<{ value: SuccessionReadiness | 'all'; label: string }> = [
  { value: 'all', label: 'All readiness' },
  { value: 'ready', label: 'Ready now' },
  { value: '12mo', label: 'Ready in 12 months' },
  { value: '24mo', label: 'Ready in 24 months' },
  { value: 'long-term', label: 'Long-term' },
];

function readinessBadgeVariant(r: string): 'success' | 'warning' | 'ghost' {
  if (r === 'ready') return 'success';
  if (r === '12mo') return 'warning';
  return 'ghost';
}

function readinessLabel(r: string): string {
  if (r === 'ready') return 'Ready now';
  if (r === '12mo') return 'Ready 12mo';
  if (r === '24mo') return 'Ready 24mo';
  if (r === 'long-term') return 'Long-term';
  return r;
}

type Row = CrmSuccessionDoc & { _id: string };

/* ─── KPI strip ─────────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: string | number;
  tone?: 'green' | 'amber' | 'blue';
}

function KpiCard({ label, value, tone }: KpiCardProps) {
  const cls =
    tone === 'green'
      ? 'text-green-600'
      : tone === 'amber'
        ? 'text-amber-600'
        : tone === 'blue'
          ? 'text-blue-600'
          : 'text-zoru-ink';
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-3">
      <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">{label}</span>
      <span className={`text-xl font-semibold tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function SuccessionPage() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [readinessFilter, setReadinessFilter] = React.useState<SuccessionReadiness | 'all'>('all');

  const [pendingDelete, setPendingDelete] = React.useState<Row | null>(null);
  const [deletePending, startDelete] = React.useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = React.useState(false);
  const [bulkPending, startBulk] = React.useTransition();

  const { toast } = useZoruToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCrmSuccessionPlans('active');
      setRows(
        data.map((d) => ({ ...d, _id: String(d._id) })) as Row[],
      );
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
  const filtered = React.useMemo((): Row[] => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (readinessFilter !== 'all' && r.readiness !== readinessFilter) return false;
      if (q) {
        const hay = [
          r.role,
          r.incumbentName ?? '',
          r.incumbentEmployeeId ?? '',
          r.notes ?? '',
          r.candidates.map((c) => c.name).join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, readinessFilter]);

  const kpis = React.useMemo(() => {
    const total = rows.length;
    const readyNow = rows.filter((r) => r.readiness === 'ready').length;
    const ready12 = rows.filter((r) => r.readiness === '12mo').length;
    const ready24 = rows.filter((r) => r.readiness === '24mo').length;
    const roles = new Set(rows.map((r) => r.role).filter(Boolean)).size;
    return { total, readyNow, ready12, ready24, roles };
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
      const res = await deleteCrmSuccessionPlan(id);
      if (res.success) {
        toast({ title: 'Succession plan deleted' });
        setPendingDelete(null);
        await refresh();
      } else {
        toast({ title: 'Error', description: res.error ?? 'Could not delete.', variant: 'destructive' });
      }
    });
  };

  // Bulk delete
  const handleBulkDelete = () => {
    const ids = Array.from(selected);
    startBulk(async () => {
      const res = await bulkDeleteCrmSuccessionPlans(ids);
      toast({
        title: `${res.succeeded} plan${res.succeeded !== 1 ? 's' : ''} deleted`,
        variant: res.failed > 0 ? 'destructive' : 'default',
      });
      setSelected(new Set());
      setConfirmBulkDelete(false);
      await refresh();
    });
  };

  // Export
  const handleExport = () => {
    downloadCsv(
      `succession-${dateStamp()}.csv`,
      ['Role', 'Incumbent', 'Readiness', 'Candidates', 'Notes'],
      filtered.map((r) => ({
        Role: r.role,
        Incumbent: r.incumbentName ?? r.incumbentEmployeeId ?? '',
        Readiness: readinessLabel(r.readiness),
        Candidates: r.candidates.map((c) => c.name).join('; '),
        Notes: r.notes ?? '',
      })),
    );
  };

  return (
    <>
      <EntityListShell
        title="Succession Planning"
        subtitle="Role continuity and successor readiness."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <UserPlus className="mr-1.5 h-3.5 w-3.5" /> New plan
              </Link>
            </ZoruButton>
          </div>
        }
        search={{ value: search, onChange: setSearch, placeholder: 'Search by role, employee…' }}
        filters={
          <ZoruSelect
            value={readinessFilter}
            onValueChange={(v) => setReadinessFilter(v as SuccessionReadiness | 'all')}
          >
            <ZoruSelectTrigger className="h-9 w-[190px]">
              <ZoruSelectValue placeholder="All readiness" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {READINESS_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-2">
              <span className="text-[13px] text-zoru-ink-muted">{selected.size} selected</span>
              <ZoruButton
                size="sm"
                variant="outline"
                disabled={bulkPending}
                onClick={() => setConfirmBulkDelete(true)}
                className="text-destructive"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </ZoruButton>
              <ZoruButton size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </ZoruButton>
            </div>
          ) : null
        }
        loading={isLoading && rows.length === 0}
      >
        {/* KPI strip */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiCard label="Active plans" value={kpis.total} />
          <KpiCard label="Ready now" value={kpis.readyNow} tone="green" />
          <KpiCard label="Ready in 12mo" value={kpis.ready12} tone="amber" />
          <KpiCard label="Ready in 24mo" value={kpis.ready24} />
          <KpiCard label="Roles covered" value={kpis.roles} tone="blue" />
        </div>

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-10 px-3">
                  <ZoruCheckbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Role</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Incumbent</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Candidates</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Readiness</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Notes</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={7} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : filtered.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={7} className="h-24 text-center text-zoru-ink-muted">
                    No succession plans match this filter.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((r) => {
                  const isChecked = selected.has(r._id);
                  const candidateCount = r.candidates.length;
                  return (
                    <ZoruTableRow
                      key={r._id}
                      className={`border-zoru-line ${isChecked ? 'bg-zoru-surface-active' : ''}`}
                    >
                      <ZoruTableCell className="px-3">
                        <ZoruCheckbox
                          checked={isChecked}
                          onCheckedChange={() => toggleOne(r._id)}
                          aria-label={`Select ${r.role}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        <EntityRowLink
                          href={`${BASE}/${r._id}`}
                          label={r.role}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {r.incumbentName ?? r.incumbentEmployeeId ?? (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {candidateCount > 0 ? (
                          <span className="tabular-nums">{candidateCount} candidate{candidateCount !== 1 ? 's' : ''}</span>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={readinessBadgeVariant(r.readiness)}>
                          {readinessLabel(r.readiness)}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="max-w-[180px] truncate text-[12.5px] text-zoru-ink-muted">
                        {r.notes ?? '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <ZoruButton variant="ghost" size="icon" asChild>
                          <Link href={`${BASE}/${r._id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </ZoruButton>
                        <ZoruButton
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingDelete(r)}
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

      {/* Single delete */}
      <ZoruAlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete succession plan?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              The plan for &ldquo;{pendingDelete?.role}&rdquo; will be archived.
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
      <ZoruAlertDialog
        open={confirmBulkDelete}
        onOpenChange={(o) => !o && setConfirmBulkDelete(false)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete {selected.size} plan{selected.size !== 1 ? 's' : ''}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              The selected succession plans will be archived (soft-deleted).
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleBulkDelete} disabled={bulkPending}>
              {bulkPending ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
