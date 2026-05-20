'use client';

/**
 * Appraisal reviews — list page rebuilt to §1D.1 bar.
 *
 * KPI strip: Drafts · Pending self · Pending manager · Completed.
 * Server actions preserved: getCrmAppraisalReviews / deleteCrmAppraisalReview.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Star } from 'lucide-react';
import { format } from 'date-fns';

import {
  getCrmAppraisalReviews,
  deleteCrmAppraisalReview,
} from '@/app/actions/crm-hr-appraisals.actions';
import {
  HrChip,
  HrListShell,
  HrStatusCell,
  type HrExportColumn,
} from '../../hr/_components/hr-list-shell';

type Row = {
  _id: string;
  employeeId?: string;
  reviewerId?: string;
  reviewDate?: string | Date;
  status?: string;
  cycle?: string;
  employeeInfo?: { firstName?: string; lastName?: string };
  reviewerInfo?: { name?: string };
  ratings?: Record<string, number>;
};

function avgRatings(ratings?: Record<string, number>): number {
  if (!ratings) return 0;
  const vals = Object.values(ratings).filter(
    (v): v is number => typeof v === 'number' && !Number.isNaN(v),
  );
  if (!vals.length) return 0;
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

export default function AppraisalReviewsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = (await getCrmAppraisalReviews()) as unknown as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const EXPORT_COLS: HrExportColumn<Row>[] = [
    { label: 'Employee', value: (r) => r.employeeInfo ? `${r.employeeInfo.firstName ?? ''} ${r.employeeInfo.lastName ?? ''}`.trim() : '' },
    { label: 'Reviewer', value: (r) => r.reviewerInfo?.name ?? '' },
    { label: 'Cycle', value: (r) => r.cycle ?? '' },
    { label: 'Status', value: (r) => r.status ?? '' },
    { label: 'Review Date', value: (r) => r.reviewDate ? new Date(r.reviewDate).toISOString().slice(0, 10) : '' },
  ];

  const kpis = React.useMemo(() => {
    const total = rows.length;
    const completed = rows.filter(
      (r) => String(r.status ?? '').toLowerCase() === 'completed',
    ).length;
    const scheduled = rows.filter(
      (r) => String(r.status ?? '').toLowerCase() === 'scheduled',
    ).length;
    const cancelled = rows.filter(
      (r) => String(r.status ?? '').toLowerCase() === 'cancelled',
    ).length;
    return [
      { label: 'Total', value: total },
      { label: 'Scheduled', value: scheduled, tone: 'amber' as const, hint: 'Awaiting review' },
      { label: 'Completed', value: completed, tone: 'green' as const },
      { label: 'Cancelled', value: cancelled, tone: 'red' as const },
    ];
  }, [rows]);

  return (
    <HrListShell<Row>
      title="Appraisal reviews"
      subtitle="Performance evaluations — ratings, strengths, improvement areas, increment suggestions."
      icon={Star}
      newHref="/dashboard/crm/hr-payroll/appraisal-reviews/new"
      editHref={(r) => `/dashboard/crm/hr-payroll/appraisal-reviews/${r._id}/edit`}
      detailHref={(r) => `/dashboard/crm/hr-payroll/appraisal-reviews/${r._id}`}
      rows={rows}
      loading={isLoading}
      kpis={kpis}
      statusOptions={[
        { value: 'Scheduled', label: 'Scheduled' },
        { value: 'Completed', label: 'Completed' },
        { value: 'Cancelled', label: 'Cancelled' },
      ]}
      getRowStatus={(r) => String(r.status ?? '')}
      searchPlaceholder="Search by employee or reviewer…"
      searchPredicate={(r, q) => {
        const emp = r.employeeInfo
          ? `${r.employeeInfo.firstName ?? ''} ${r.employeeInfo.lastName ?? ''}`.toLowerCase()
          : '';
        const rev = (r.reviewerInfo?.name ?? '').toLowerCase();
        return emp.includes(q) || rev.includes(q);
      }}
      onDelete={deleteCrmAppraisalReview}
      onAfterChange={refresh}
      exportColumns={EXPORT_COLS}
      exportBaseName="appraisal-reviews"
      emptyText="No appraisals yet"
      columns={[
        {
          key: 'employee',
          label: 'Employee',
          render: (r) =>
            r.employeeInfo
              ? `${r.employeeInfo.firstName ?? ''} ${r.employeeInfo.lastName ?? ''}`.trim() ||
                '—'
              : '—',
        },
        {
          key: 'reviewer',
          label: 'Reviewer',
          render: (r) => r.reviewerInfo?.name ?? '—',
        },
        {
          key: 'cycle',
          label: 'Cycle',
          render: (r) => (r.cycle ? <HrChip>{r.cycle}</HrChip> : <span className="text-zoru-ink-muted">—</span>),
        },
        {
          key: 'period',
          label: 'Review date',
          render: (r) =>
            r.reviewDate ? format(new Date(r.reviewDate), 'PP') : '—',
        },
        {
          key: 'rating',
          label: 'Overall',
          render: (r) => <StarBar value={avgRatings(r.ratings)} />,
        },
        {
          key: 'status',
          label: 'Status',
          render: (r) => <HrStatusCell value={String(r.status ?? '')} />,
        },
      ]}
    />
  );
}
