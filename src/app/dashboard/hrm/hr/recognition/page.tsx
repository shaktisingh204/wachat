'use client';

/**
 * Recognition — list page rebuilt to §1D.1 bar.
 *
 * KPI strip: Total · This month · Points awarded · Public count.
 * Server actions preserved: getRecognitions / deleteRecognition.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Award } from 'lucide-react';

import {
  getRecognitions,
  deleteRecognition,
} from '@/app/actions/hr.actions';
import type { HrRecognition } from '@/lib/hr-types';

import {
  HrChip,
  HrDateCell,
  HrListShell,
} from '../_components/hr-list-shell';
import { StatusPill } from '@/components/crm/status-pill';

type Row = HrRecognition & {
  _id: string;
  title?: string;
};

export default function RecognitionPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = (await getRecognitions()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const kpis = React.useMemo(() => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let thisMonth = 0;
    let points = 0;
    let publicCount = 0;
    for (const r of rows) {
      const t = r.givenAt ? new Date(r.givenAt).getTime() : NaN;
      if (Number.isFinite(t) && t >= firstOfMonth) thisMonth += 1;
      points += Number(r.points) || 0;
      if (r.visibility === 'public') publicCount += 1;
    }
    return [
      { label: 'Total', value: rows.length },
      { label: 'This month', value: thisMonth, tone: 'blue' as const },
      { label: 'Points awarded', value: points },
      { label: 'Public', value: publicCount, tone: 'green' as const },
    ];
  }, [rows]);

  return (
    <HrListShell<Row>
      title="Recognition"
      subtitle="Kudos, spot awards, and peer-to-peer recognition."
      icon={Award}
      newHref="/dashboard/hrm/hr/recognition/new"
      editHref={(r) => `/dashboard/hrm/hr/recognition/${r._id}/edit`}
      detailHref={(r) => `/dashboard/hrm/hr/recognition/${r._id}`}
      rows={rows}
      loading={isLoading}
      kpis={kpis}
      statusOptions={[
        { value: 'kudos', label: 'Kudos' },
        { value: 'spot-award', label: 'Spot Award' },
        { value: 'performance', label: 'Performance' },
        { value: 'values', label: 'Values' },
      ]}
      getRowStatus={(r) => String(r.type ?? '')}
      searchPlaceholder="Search messages / recipients…"
      searchPredicate={(r, q) =>
        String(r.message ?? '').toLowerCase().includes(q) ||
        String(r.fromName ?? '').toLowerCase().includes(q)
      }
      onDelete={deleteRecognition}
      onAfterChange={refresh}
      emptyText="No recognition yet — start celebrating wins!"
      columns={[
        {
          key: 'employee',
          label: 'Recipient',
          render: (r) => String(r.employeeId ?? '—'),
        },
        {
          key: 'type',
          label: 'Type',
          render: (r) => <HrChip>{r.type}</HrChip>,
        },
        {
          key: 'points',
          label: 'Points',
          render: (r) =>
            r.points != null ? (
              <span className="tabular-nums">{r.points}</span>
            ) : (
              <span className="text-[var(--st-text-secondary)]">—</span>
            ),
        },
        {
          key: 'message',
          label: 'Message',
          render: (r) => (
            <span className="block max-w-[260px] truncate text-[var(--st-text-secondary)]">
              {r.message ?? '—'}
            </span>
          ),
        },
        { key: 'from', label: 'From', render: (r) => r.fromName ?? '—' },
        {
          key: 'visibility',
          label: 'Visibility',
          render: (r) =>
            r.visibility ? (
              <StatusPill
                label={r.visibility}
                tone={r.visibility === 'public' ? 'green' : 'neutral'}
              />
            ) : (
              <span className="text-[var(--st-text-secondary)]">—</span>
            ),
        },
        { key: 'givenAt', label: 'Date', render: (r) => <HrDateCell value={r.givenAt} /> },
      ]}
    />
  );
}
