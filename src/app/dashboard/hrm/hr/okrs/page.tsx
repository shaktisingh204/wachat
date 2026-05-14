'use client';

/**
 * OKRs — list page rebuilt to §1D.1 bar.
 *
 * Uses <HrListShell> with KPI strip (Active · Completed · Avg progress ·
 * On-track count), status chip filter, search, bulk delete.
 *
 * Form lives at /new and /[id]/edit (HrFormPage on top of EntityFormShell).
 * The `keyResults` array editor is rendered by HrFormPage's FieldArray and
 * persisted to MongoDB via existing `saveOkr` action (jsonKeys: ['keyResults']).
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Target } from 'lucide-react';

import { getOkrs, deleteOkr } from '@/app/actions/hr.actions';
import type { HrOkr } from '@/lib/hr-types';
import {
  HrChip,
  HrDateCell,
  HrListShell,
  HrProgressCell,
  HrStatusCell,
} from '../_components/hr-list-shell';

type Row = HrOkr & {
  _id: string;
  title?: string;
  type?: string;
  due_date?: string | Date;
  progress?: number;
};

function avgKrProgress(keyResults: Row['keyResults']): number {
  if (!Array.isArray(keyResults) || keyResults.length === 0) return 0;
  const sum = keyResults.reduce((a, k) => a + (Number(k?.progress) || 0), 0);
  return Math.round(sum / keyResults.length);
}

export default function OkrsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = (await getOkrs()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const kpis = React.useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => {
      const s = String(r.status ?? '').toLowerCase();
      return s === 'achieved' || s === 'completed';
    }).length;
    const active = rows.filter((r) => {
      const s = String(r.status ?? '').toLowerCase();
      return s === 'in-progress' || s === 'on-track';
    }).length;
    const onTrack = rows.filter(
      (r) => String(r.status ?? '').toLowerCase() === 'on-track',
    ).length;
    const avgProgress = total
      ? Math.round(
          rows.reduce(
            (a, r) =>
              a +
              (Number(r.progress) ||
                avgKrProgress(r.keyResults as Row['keyResults'])),
            0,
          ) / total,
        )
      : 0;
    return [
      { label: 'Active', value: active },
      { label: 'Completed', value: completed, tone: 'green' as const },
      { label: 'Avg progress', value: `${avgProgress}%` },
      { label: 'On-track', value: onTrack, tone: 'blue' as const },
    ];
  }, [rows]);

  return (
    <HrListShell<Row>
      title="OKRs"
      subtitle="Objectives and key results — individual, team, and company level."
      icon={Target}
      newHref="/dashboard/hrm/hr/okrs/new"
      editHref={(r) => `/dashboard/hrm/hr/okrs/${String(r._id)}/edit`}
      detailHref={(r) => `/dashboard/hrm/hr/okrs/${String(r._id)}`}
      rows={rows}
      loading={isLoading}
      kpis={kpis}
      statusOptions={[
        { value: 'on-track', label: 'On track' },
        { value: 'at-risk', label: 'At risk' },
        { value: 'off-track', label: 'Off track' },
        { value: 'completed', label: 'Completed' },
      ]}
      getRowStatus={(r) => String(r.status ?? '')}
      searchPlaceholder="Search objectives…"
      searchPredicate={(r, q) =>
        String(r.title ?? r.objective ?? '').toLowerCase().includes(q)
      }
      onDelete={deleteOkr}
      onAfterChange={refresh}
      emptyText="No OKRs yet"
      columns={[
        {
          key: 'objective',
          label: 'Objective',
          render: (r) => (
            <span className="block max-w-[280px] truncate font-medium">
              {r.title ?? r.objective ?? '—'}
            </span>
          ),
        },
        {
          key: 'period',
          label: 'Period',
          render: (r) => {
            const period = r.quarter;
            return period ? <HrChip>{period}</HrChip> : <span className="text-zoru-ink-muted">—</span>;
          },
        },
        {
          key: 'type',
          label: 'Type',
          render: (r) => (r.type ? <HrChip>{r.type}</HrChip> : <span className="text-zoru-ink-muted">—</span>),
        },
        {
          key: 'krs',
          label: 'KRs',
          render: (r) => (
            <span className="tabular-nums">
              {Array.isArray(r.keyResults) ? r.keyResults.length : 0}
            </span>
          ),
        },
        {
          key: 'progress',
          label: 'Score',
          render: (r) => (
            <HrProgressCell
              value={r.progress ?? avgKrProgress(r.keyResults as Row['keyResults'])}
            />
          ),
        },
        {
          key: 'due',
          label: 'Due',
          render: (r) => <HrDateCell value={r.due_date} />,
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
