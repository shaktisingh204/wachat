'use client';

/**
 * Onboarding list — `/dashboard/crm/hr/onboarding`.
 *
 * KPI strip: total · in-progress · completed this month · avg completion days.
 * Bulk: complete, delete with confirm.
 * Export: CSV.
 * Keeps existing search + status filter + URL-driven pagination.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Download, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import {
  deleteOnboarding,
  bulkCompleteOnboardings,
  bulkDeleteOnboardings,
  type OnboardingKpis,
} from '@/app/actions/crm-onboarding.actions';
import type {
  CrmOnboardingDoc,
  CrmOnboardingStatus,
} from '@/lib/rust-client/crm-onboarding';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

/* ─── Props ──────────────────────────────────────────────────────────── */

interface OnboardingViewProps {
  items: CrmOnboardingDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  initialStatus: string;
  kpis: OnboardingKpis;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

type Phase = 'Pre-joining' | 'Day-1' | 'Week-1' | 'Month-1' | 'Completed';

const STATUS_OPTIONS: ReadonlyArray<{ value: '' | CrmOnboardingStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
];

const DAY_MS = 86_400_000;

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function shortenId(id?: string): string {
  if (!id) return '—';
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function computePhase(doc: CrmOnboardingDoc): Phase {
  if (doc.status === 'completed') return 'Completed';
  if (!doc.joiningDate) return 'Pre-joining';
  const joined = new Date(doc.joiningDate).getTime();
  if (!Number.isFinite(joined)) return 'Pre-joining';
  const now = Date.now();
  const diffDays = Math.floor((now - joined) / DAY_MS);
  if (diffDays < 0) return 'Pre-joining';
  if (diffDays < 1) return 'Day-1';
  if (diffDays < 7) return 'Week-1';
  return 'Month-1';
}

function clampProgress(p?: number, status?: CrmOnboardingStatus): number {
  if (status === 'completed') return 100;
  if (typeof p !== 'number' || !Number.isFinite(p)) return 0;
  return Math.min(100, Math.max(0, Math.round(p)));
}

function rowLabel(doc: CrmOnboardingDoc): string {
  return doc.employeeName?.trim() || `Hire ${shortenId(doc.employeeId)}`;
}

/* ─── KPI strip ─────────────────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'green' | 'amber' | 'blue';
}) {
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

/* ─── View ───────────────────────────────────────────────────────────── */

type BulkOp = 'complete' | 'delete';

export function OnboardingView({
  items,
  page,
  limit,
  hasMore,
  initialQuery,
  initialStatus,
  kpis,
}: OnboardingViewProps): React.JSX.Element {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<string>(initialStatus);
  const [deleting, startDelete] = React.useTransition();

  // Bulk
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkOp, setBulkOp] = React.useState<BulkOp | null>(null);
  const [bulkPending, startBulk] = React.useTransition();

  // Debounce search → URL
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      const trimmed = query.trim();
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, sp, pathname, router]);

  const onStatusChange = (next: string) => {
    setStatusFilter(next);
    const params = new URLSearchParams(sp?.toString() ?? '');
    if (next) params.set('status', next);
    else params.delete('status');
    params.set('page', '1');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('');
    router.push(pathname);
  };

  const hasActiveFilters = !!query.trim() || !!statusFilter;

  // Client-side defensive filter
  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle && !statusFilter) return items;
    return items.filter((doc) => {
      if (statusFilter && doc.status !== statusFilter) return false;
      if (!needle) return true;
      const hay = [doc.employeeName ?? '', doc.employeeId ?? '', doc.candidateId ?? '', doc.notes ?? '']
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [items, query, statusFilter]);

  // Selection
  const allIds = filtered.map((d) => String(d._id));
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
  const confirmDelete = (doc: CrmOnboardingDoc) => {
    if (!doc._id) return;
    const id = String(doc._id);
    const label = rowLabel(doc);
    startDelete(async () => {
      const res = await deleteOnboarding(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  // Bulk execute
  const executeBulk = (op: BulkOp) => {
    const ids = Array.from(selected);
    startBulk(async () => {
      const res =
        op === 'complete' ? await bulkCompleteOnboardings(ids) : await bulkDeleteOnboardings(ids);
      const verb = op === 'complete' ? 'completed' : 'deleted';
      toast({
        title: `${res.succeeded} onboarding${res.succeeded !== 1 ? 's' : ''} ${verb}`,
        variant: res.failed > 0 ? 'destructive' : 'default',
      });
      setSelected(new Set());
      setBulkOp(null);
      router.refresh();
    });
  };

  // Export
  const handleExport = () => {
    downloadCsv(
      `onboarding-${dateStamp()}.csv`,
      ['Employee', 'Joining date', 'Manager', 'Buddy', 'Phase', 'Progress', 'Status'],
      filtered.map((doc) => ({
        Employee: rowLabel(doc),
        'Joining date': fmtDate(doc.joiningDate),
        Manager: shortenId(doc.managerId),
        Buddy: shortenId(doc.buddyId),
        Phase: computePhase(doc),
        Progress: clampProgress(doc.progress, doc.status),
        Status: doc.status ?? '',
      })),
    );
  };

  return (
    <>
      <EntityListShell
        title="Onboarding"
        subtitle="Track new joiners through pre-joining, Day-1, Week-1 and Month-1."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </ZoruButton>
            <ZoruButton asChild>
              <Link href="/dashboard/crm/hr/onboarding/new">
                <Plus className="h-4 w-4" />
                New onboarding
              </Link>
            </ZoruButton>
          </div>
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
              <ZoruInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by employee, notes…"
                className="h-9 pl-9 text-[13px]"
              />
            </div>
            <ZoruSelect
              value={statusFilter || 'all'}
              onValueChange={(v) => onStatusChange(v === 'all' ? '' : v)}
            >
              <ZoruSelectTrigger className="h-9 w-[180px] text-[13px]">
                <ZoruSelectValue placeholder="All statuses" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <ZoruSelectItem key={opt.value || 'all'} value={opt.value || 'all'}>
                    {opt.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            {hasActiveFilters ? (
              <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Clear
              </ZoruButton>
            ) : null}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-2">
              <span className="text-[13px] text-zoru-ink-muted">{selected.size} selected</span>
              <ZoruButton size="sm" variant="outline" disabled={bulkPending} onClick={() => executeBulk('complete')}>
                Mark complete
              </ZoruButton>
              <ZoruButton
                size="sm"
                variant="outline"
                disabled={bulkPending}
                onClick={() => setBulkOp('delete')}
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
        pagination={<PaginationBar page={page} limit={limit} hasMore={hasMore} />}
      >
        {/* KPI strip */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Total onboarding" value={kpis.total} />
          <KpiCard label="In progress" value={kpis.inProgress} tone="amber" />
          <KpiCard label="Completed this month" value={kpis.completedThisMonth} tone="green" />
          <KpiCard label="Avg completion (days)" value={kpis.avgCompletionDays} tone="blue" />
        </div>

        <ZoruCard className="overflow-hidden p-0">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="w-10 px-3">
                  <ZoruCheckbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead>Employee</ZoruTableHead>
                <ZoruTableHead>Joining date</ZoruTableHead>
                <ZoruTableHead>Mentor</ZoruTableHead>
                <ZoruTableHead>Buddy</ZoruTableHead>
                <ZoruTableHead>Current phase</ZoruTableHead>
                <ZoruTableHead>Progress</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filtered.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={9}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    {hasActiveFilters
                      ? 'No onboardings match these filters.'
                      : 'No onboardings yet — click "New onboarding" to add one.'}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((doc) => {
                  const id = String(doc._id);
                  const employeeName = rowLabel(doc);
                  const joiningDate = fmtDate(doc.joiningDate);
                  const phase = computePhase(doc);
                  const progress = clampProgress(doc.progress, doc.status);
                  const isChecked = selected.has(id);
                  return (
                    <ZoruTableRow key={id} className={isChecked ? 'bg-zoru-surface-active' : ''}>
                      <ZoruTableCell className="px-3">
                        <ZoruCheckbox
                          checked={isChecked}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label={`Select ${employeeName}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <EntityRowLink
                          href={`/dashboard/crm/hr/onboarding/${id}`}
                          label={employeeName}
                          subtitle={`joins ${joiningDate}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                        {joiningDate}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                        {shortenId(doc.managerId)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                        {shortenId(doc.buddyId)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill
                          label={phase}
                          tone={phase === 'Completed' ? 'green' : 'blue'}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <div className="flex min-w-[88px] items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zoru-line">
                            <div
                              className="h-full rounded-full bg-zoru-primary"
                              style={{ width: `${progress}%` }}
                              aria-hidden
                            />
                          </div>
                          <span className="w-9 text-right text-[11.5px] tabular-nums text-zoru-ink-muted">
                            {progress}%
                          </span>
                        </div>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill
                          label={doc.status ?? 'pending'}
                          tone={statusToTone(doc.status)}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <ZoruButton size="sm" variant="ghost" asChild>
                            <Link href={`/dashboard/crm/hr/onboarding/${id}/edit`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </ZoruButton>
                          <ZoruButton
                            size="sm"
                            variant="ghost"
                            onClick={() => confirmDelete(doc)}
                            disabled={deleting}
                            className="text-zoru-danger-ink"
                            aria-label={`Delete onboarding for ${employeeName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </ZoruButton>
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </ZoruTable>
        </ZoruCard>
      </EntityListShell>

      {/* Bulk delete confirm */}
      <ZoruAlertDialog open={bulkOp === 'delete'} onOpenChange={(o) => !o && setBulkOp(null)}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete {selected.size} onboarding{selected.size !== 1 ? 's' : ''}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              The selected onboarding records will be permanently deleted.
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
