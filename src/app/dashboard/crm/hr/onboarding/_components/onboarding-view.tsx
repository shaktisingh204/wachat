'use client';

/**
 * Onboarding list — `/dashboard/crm/hr/onboarding`.
 *
 * Client side of the list. Wraps the Rust-backed `CrmOnboardingDoc`
 * collection in the shared `<EntityListShell>` and renders one row per
 * new joiner with: employee · joining date · mentor · buddy ·
 * current phase · progress % · actions.
 *
 * The "current phase" column is derived from `joiningDate` (Pre-joining /
 * Day-1 / Week-1 / Month-1) when no explicit phase is stored on the doc;
 * the helper short-circuits to `Completed` when `status === 'completed'`.
 *
 * Baseline: `src/app/dashboard/crm/bookings/_components/booking-list-client.tsx`.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
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
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { deleteOnboarding } from '@/app/actions/crm-onboarding.actions';
import type {
  CrmOnboardingDoc,
  CrmOnboardingStatus,
} from '@/lib/rust-client/crm-onboarding';

interface OnboardingViewProps {
  items: CrmOnboardingDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  initialStatus: string;
}

type Phase = 'Pre-joining' | 'Day-1' | 'Week-1' | 'Month-1' | 'Completed';

const STATUS_OPTIONS: ReadonlyArray<{
  value: '' | CrmOnboardingStatus;
  label: string;
}> = [
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
  if (p < 0) return 0;
  if (p > 100) return 100;
  return Math.round(p);
}

function rowLabel(doc: CrmOnboardingDoc): string {
  return doc.employeeName?.trim() || `Hire ${shortenId(doc.employeeId)}`;
}

export function OnboardingView({
  items,
  page,
  limit,
  hasMore,
  initialQuery,
  initialStatus,
}: OnboardingViewProps): React.JSX.Element {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<string>(initialStatus);
  const [deleting, startDelete] = React.useTransition();

  // Debounce search → URL.
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

  // The Rust list endpoint already handles `q`/`status`, but we still
  // apply a defensive client filter so the visible page reflects the
  // current search box even before the URL round-trip completes.
  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle && !statusFilter) return items;
    return items.filter((doc) => {
      if (statusFilter && doc.status !== statusFilter) return false;
      if (!needle) return true;
      const hay = [
        doc.employeeName ?? '',
        doc.employeeId ?? '',
        doc.candidateId ?? '',
        doc.notes ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [items, query, statusFilter]);

  const confirmDelete = (doc: CrmOnboardingDoc) => {
    if (!doc._id) return;
    const id = String(doc._id);
    const label = rowLabel(doc);
    if (typeof window !== 'undefined') {
      const ok = window.confirm(`Delete onboarding for ${label}?`);
      if (!ok) return;
    }
    startDelete(async () => {
      const res = await deleteOnboarding(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        router.refresh();
      } else {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <EntityListShell
      title="Onboarding"
      subtitle="Track new joiners through pre-joining, Day-1, Week-1 and Month-1."
      primaryAction={
        <ZoruButton asChild>
          <Link href="/dashboard/crm/hr/onboarding/new">
            <Plus className="h-4 w-4" />
            New onboarding
          </Link>
        </ZoruButton>
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
          <ZoruSelect value={statusFilter || 'all'} onValueChange={(v) => onStatusChange(v === 'all' ? '' : v)}>
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
      pagination={<PaginationBar page={page} limit={limit} hasMore={hasMore} />}
    >
      <ZoruCard className="overflow-hidden p-0">
        <ZoruTable>
          <ZoruTableHeader>
            <ZoruTableRow>
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
                  colSpan={8}
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
                return (
                  <ZoruTableRow key={id}>
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
  );
}
