'use client';

/**
 * 360° Feedback — §1D Deep-list page.
 *
 * KPI strip:
 *   - Total cycles    (distinct period/reviewCycle values)
 *   - In progress      (status === "pending")
 *   - Complete         (status === "submitted")
 *   - Avg response rate (submitted / total %)
 *
 * Filters: search · status · cycle · department · owner (reviewee) · date range
 * Bulk:    archive · delete · send-reminder · export CSV / XLSX
 */

import * as React from 'react';
import Link from 'next/link';
import { Plus, Star } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
  bulkArchiveFeedback360,
  bulkDeleteFeedback360,
  bulkRemindFeedback360,
  deleteFeedback360,
  getFeedback360,
} from '@/app/actions/hr.actions';
import type { HrFeedback360 } from '@/lib/hr-types';

import {
  HrChip,
  HrStatusCell,
} from '../_components/hr-list-shell';
import {
  HrDeepListBody,
  type DeepColumn,
} from '../_components/hr-deep-list-body';

type Row = HrFeedback360 & {
  _id: string;
  reviewer_id?: string;
  reviewee_id?: string;
  type?: string;
  period?: string;
  status?: string;
  department?: string;
  rating_communication?: number;
  rating_teamwork?: number;
  rating_leadership?: number;
  rating_technical?: number;
  reviewCycle?: string;
};

const BASE = '/dashboard/crm/hr/feedback-360';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'In progress' },
  { value: 'submitted', label: 'Complete' },
];

function avgRating(r: Row): number {
  const vals = [
    r.rating_communication,
    r.rating_teamwork,
    r.rating_leadership,
    r.rating_technical,
    r.rating,
  ].filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function StarBar({ value }: { value: number }) {
  const n = Math.round(Math.min(5, Math.max(0, value)));
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i <= n ? 'fill-yellow-400 text-yellow-400' : 'fill-transparent text-zoru-line'}`}
        />
      ))}
      <span className="ml-1 text-[12px] tabular-nums text-zoru-ink-muted">
        {value > 0 ? value.toFixed(1) : '—'}
      </span>
    </div>
  );
}

function rowDate(r: Row): number | null {
  const v = r.submittedAt ?? r.updatedAt ?? r.createdAt;
  if (!v) return null;
  const t = new Date(v as string | Date).getTime();
  return Number.isFinite(t) ? t : null;
}

export default function Feedback360Page(): React.JSX.Element {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [isLoading, startTransition] = React.useTransition();

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [cycle, setCycle] = React.useState<string>('all');
  const [dept, setDept] = React.useState<string>('all');
  const [reviewee, setReviewee] = React.useState<string>('all');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  const refresh = React.useCallback(() => {
    startTransition(async () => {
      const data = (await getFeedback360()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  /* ── KPIs ──────────────────────────────────────────────────────── */

  const kpis = React.useMemo(() => {
    const total = rows.length;
    const cycles = new Set<string>();
    for (const r of rows) {
      const k = r.period ?? r.reviewCycle;
      if (k) cycles.add(k);
    }
    const inProgress = rows.filter(
      (r) => String(r.status ?? '').toLowerCase() === 'pending',
    ).length;
    const submitted = rows.filter(
      (r) => String(r.status ?? '').toLowerCase() === 'submitted',
    ).length;
    const responseRate = total > 0 ? Math.round((submitted / total) * 100) : 0;
    return { totalCycles: cycles.size, inProgress, submitted, responseRate };
  }, [rows]);

  /* ── filter options ────────────────────────────────────────────── */

  const cycleOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const k = r.period ?? r.reviewCycle;
      if (k) set.add(k);
    }
    return Array.from(set).sort().map((v) => ({ value: v, label: v }));
  }, [rows]);

  const deptOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.department) set.add(r.department);
    return Array.from(set).sort().map((v) => ({ value: v, label: v }));
  }, [rows]);

  const ownerOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const id = String(r.reviewee_id ?? r.employeeId ?? '');
      if (id) set.add(id);
    }
    return Array.from(set).map((v) => ({ value: v, label: v }));
  }, [rows]);

  /* ── filtered rows ──────────────────────────────────────────────── */

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    return rows.filter((r) => {
      const status = String(r.status ?? '').toLowerCase();
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      const c = r.period ?? r.reviewCycle ?? '';
      if (cycle !== 'all' && c !== cycle) return false;
      if (dept !== 'all' && (r.department ?? '') !== dept) return false;
      if (reviewee !== 'all') {
        const id = String(r.reviewee_id ?? r.employeeId ?? '');
        if (id !== reviewee) return false;
      }
      if (q) {
        const hay = `${r.reviewer_id ?? ''} ${r.reviewerName ?? ''} ${r.reviewee_id ?? ''} ${c}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const ts = rowDate(r);
      if (from !== null && (ts == null || ts < from)) return false;
      if (to !== null && (ts == null || ts > to)) return false;
      return true;
    });
  }, [rows, search, statusFilter, cycle, dept, reviewee, dateFrom, dateTo]);

  const columns: DeepColumn<Row>[] = React.useMemo(
    () => [
      {
        key: 'reviewee',
        label: 'Reviewee',
        render: (r) => String(r.reviewee_id ?? r.employeeId ?? '—'),
      },
      {
        key: 'reviewer',
        label: 'Reviewer',
        render: (r) => String(r.reviewer_id ?? r.reviewerName ?? '—'),
      },
      {
        key: 'type',
        label: 'Type',
        render: (r) =>
          r.type || r.reviewerType ? (
            <HrChip>{r.type ?? r.reviewerType}</HrChip>
          ) : (
            <span className="text-zoru-ink-muted">—</span>
          ),
      },
      {
        key: 'period',
        label: 'Cycle',
        render: (r) =>
          r.period || r.reviewCycle ? (
            <HrChip>{r.period ?? r.reviewCycle}</HrChip>
          ) : (
            <span className="text-zoru-ink-muted">—</span>
          ),
      },
      {
        key: 'score',
        label: 'Avg score',
        render: (r) => <StarBar value={avgRating(r)} />,
      },
      {
        key: 'status',
        label: 'Status',
        render: (r) => <HrStatusCell value={String(r.status ?? '')} />,
      },
    ],
    [],
  );

  return (
    <EntityListShell
      title="360° Feedback"
      subtitle="Peer, manager, direct-report, and self reviews per cycle."
      primaryAction={
        <ZoruButton asChild>
          <Link href={`${BASE}/new`}>
            <Plus className="h-4 w-4" /> New review
          </Link>
        </ZoruButton>
      }
      filters={
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((opt) => (
            <ZoruButton
              key={opt.value}
              variant={statusFilter === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </ZoruButton>
          ))}
        </div>
      }
      loading={isLoading && rows.length === 0}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">Total cycles</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.totalCycles}</p>
          </ZoruCard>
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">In progress</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.inProgress}</p>
          </ZoruCard>
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">Complete</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.submitted}</p>
          </ZoruCard>
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">Avg response rate</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.responseRate}%</p>
          </ZoruCard>
        </div>

        {rows.length === 0 && !isLoading ? (
          <ZoruCard className="flex min-h-[180px] flex-col items-center justify-center gap-3 p-6">
            <Star className="h-8 w-8 text-zoru-ink-muted" aria-hidden="true" />
            <p className="text-sm text-zoru-ink-muted">No 360° feedback yet.</p>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="h-4 w-4" /> Start a cycle
              </Link>
            </ZoruButton>
          </ZoruCard>
        ) : (
          <HrDeepListBody<Row>
            rows={filtered}
            columns={columns}
            getRowId={(r) => String(r._id)}
            detailHref={(r) => `${BASE}/${r._id}`}
            editHref={(r) => `${BASE}/${r._id}/edit`}
            onDeleteOne={deleteFeedback360}
            onBulkDelete={bulkDeleteFeedback360}
            onBulkArchive={bulkArchiveFeedback360}
            onBulkReminder={bulkRemindFeedback360}
            reminderLabel="Remind reviewers"
            onAfterChange={refresh}
            search={search}
            setSearch={setSearch}
            searchPlaceholder="Search reviewers / reviewees…"
            cycleOptions={cycleOptions}
            cycle={cycle}
            setCycle={setCycle}
            cycleLabel="Cycle"
            deptOptions={deptOptions}
            dept={dept}
            setDept={setDept}
            ownerOptions={ownerOptions}
            owner={reviewee}
            setOwner={setReviewee}
            dateFrom={dateFrom}
            dateTo={dateTo}
            setDateFrom={setDateFrom}
            setDateTo={setDateTo}
            exportColumns={[
              { header: 'Reviewee', value: (r) => String(r.reviewee_id ?? r.employeeId ?? '') },
              { header: 'Reviewer', value: (r) => String(r.reviewer_id ?? r.reviewerName ?? '') },
              { header: 'Type', value: (r) => String(r.type ?? r.reviewerType ?? '') },
              { header: 'Cycle', value: (r) => String(r.period ?? r.reviewCycle ?? '') },
              { header: 'Avg score', value: (r) => Number(avgRating(r).toFixed(2)) },
              { header: 'Status', value: (r) => String(r.status ?? '') },
              { header: 'Department', value: (r) => r.department ?? '' },
            ]}
            exportName="feedback-360"
            emptyText="No feedback matches these filters."
          />
        )}
      </div>
    </EntityListShell>
  );
}
