'use client';

/**
 * 360° Feedback — list page rebuilt to §1D.1 bar.
 *
 * KPI strip: Total · Pending · Submitted · Avg score.
 * Server actions preserved: getFeedback360 / deleteFeedback360.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Star } from 'lucide-react';

import {
  getFeedback360,
  deleteFeedback360,
} from '@/app/actions/hr.actions';
import type { HrFeedback360 } from '@/lib/hr-types';

import {
  HrChip,
  HrListShell,
  HrStatusCell,
} from '../_components/hr-list-shell';

type Row = HrFeedback360 & {
  _id: string;
  reviewer_id?: string;
  reviewee_id?: string;
  type?: string;
  period?: string;
  status?: string;
  rating_communication?: number;
  rating_teamwork?: number;
  rating_leadership?: number;
  rating_technical?: number;
  reviewCycle?: string;
};

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
          className={`h-3 w-3 ${i <= n ? 'fill-zoru-ink-muted text-zoru-ink-muted' : 'fill-transparent text-zoru-line'}`}
        />
      ))}
      <span className="ml-1 text-[12px] tabular-nums text-zoru-ink-muted">
        {value > 0 ? value.toFixed(1) : '—'}
      </span>
    </div>
  );
}

export default function Feedback360Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = (await getFeedback360()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const kpis = React.useMemo(() => {
    const total = rows.length;
    const pending = rows.filter(
      (r) => String(r.status ?? '').toLowerCase() === 'pending',
    ).length;
    const submitted = rows.filter(
      (r) => String(r.status ?? '').toLowerCase() === 'submitted',
    ).length;
    const ratings = rows.map(avgRating).filter((v) => v > 0);
    const avg = ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) /
        10
      : 0;
    return [
      { label: 'Total', value: total },
      { label: 'Pending', value: pending, tone: 'amber' as const },
      { label: 'Submitted', value: submitted, tone: 'green' as const },
      { label: 'Avg score', value: avg ? avg.toFixed(1) : '—' },
    ];
  }, [rows]);

  return (
    <HrListShell<Row>
      title="360° Feedback"
      subtitle="Peer, manager, direct-report, and self reviews per cycle."
      icon={Star}
      newHref="/dashboard/hrm/hr/feedback-360/new"
      editHref={(r) => `/dashboard/hrm/hr/feedback-360/${r._id}/edit`}
      detailHref={(r) => `/dashboard/hrm/hr/feedback-360/${r._id}`}
      rows={rows}
      loading={isLoading}
      kpis={kpis}
      statusOptions={[
        { value: 'pending', label: 'Pending' },
        { value: 'submitted', label: 'Submitted' },
      ]}
      getRowStatus={(r) => String(r.status ?? '')}
      searchPlaceholder="Search reviewers / reviewees…"
      searchPredicate={(r, q) =>
        String(r.reviewer_id ?? r.reviewerName ?? '').toLowerCase().includes(q) ||
        String(r.reviewee_id ?? '').toLowerCase().includes(q) ||
        String(r.period ?? r.reviewCycle ?? '').toLowerCase().includes(q)
      }
      onDelete={deleteFeedback360}
      onAfterChange={refresh}
      emptyText="No 360° feedback yet"
      columns={[
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
          label: 'Period',
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
      ]}
    />
  );
}
