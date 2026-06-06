'use client';

/**
 * Training programs — list page rebuilt to §1D.1 bar.
 *
 * KPI strip: Active · Completed · Total hours · Avg duration.
 * Server actions preserved: getTrainingPrograms / deleteTrainingProgram.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { BookOpen } from 'lucide-react';

import {
  getTrainingPrograms,
  deleteTrainingProgram,
} from '@/app/actions/hr.actions';
import type { HrTrainingProgram } from '@/lib/hr-types';

import {
  HrChip,
  HrDateCell,
  HrListShell,
  HrStatusCell,
} from '../_components/hr-list-shell';

type Row = HrTrainingProgram & {
  _id: string;
  format?: string;
  trainer?: string;
  durationHours?: number;
  maxParticipants?: number;
};

export default function TrainingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = (await getTrainingPrograms()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const kpis = React.useMemo(() => {
    const total = rows.length;
    const completed = rows.filter(
      (r) => String(r.status ?? '').toLowerCase() === 'completed',
    ).length;
    const active = rows.filter((r) => {
      const s = String(r.status ?? '').toLowerCase();
      return s === 'ongoing' || s === 'running' || s === 'upcoming' || s === 'scheduled';
    }).length;
    const totalHours = rows.reduce(
      (a, r) => a + (Number(r.durationHours) || 0),
      0,
    );
    const avg = total ? Math.round(totalHours / total) : 0;
    return [
      { label: 'Active', value: active, tone: 'blue' as const },
      { label: 'Completed', value: completed, tone: 'green' as const },
      { label: 'Total hours', value: totalHours, hint: 'Across all programs' },
      { label: 'Avg duration', value: `${avg}h` },
    ];
  }, [rows]);

  return (
    <HrListShell<Row>
      title="Training programs"
      subtitle="Online, classroom, and on-the-job learning sessions."
      icon={BookOpen}
      newHref="/dashboard/hrm/hr/training/new"
      editHref={(r) => `/dashboard/hrm/hr/training/${r._id}/edit`}
      detailHref={(r) => `/dashboard/hrm/hr/training/${r._id}`}
      rows={rows}
      loading={isLoading}
      kpis={kpis}
      statusOptions={[
        { value: 'upcoming', label: 'Upcoming' },
        { value: 'ongoing', label: 'Ongoing' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'draft', label: 'Draft' },
      ]}
      getRowStatus={(r) => String(r.status ?? '')}
      searchPlaceholder="Search programs…"
      searchPredicate={(r, q) =>
        String(r.name ?? '').toLowerCase().includes(q) ||
        String(r.trainer ?? '').toLowerCase().includes(q)
      }
      onDelete={deleteTrainingProgram}
      onAfterChange={refresh}
      emptyText="No training programs yet"
      columns={[
        {
          key: 'name',
          label: 'Program',
          render: (r) => (
            <span className="block max-w-[260px] truncate font-medium">
              {r.name}
            </span>
          ),
        },
        {
          key: 'format',
          label: 'Mode',
          render: (r) => (r.format ? <HrChip>{r.format}</HrChip> : <span className="text-[var(--st-text-secondary)]">—</span>),
        },
        { key: 'trainer', label: 'Trainer', render: (r) => r.trainer ?? '—' },
        { key: 'start', label: 'Start', render: (r) => <HrDateCell value={r.startDate} /> },
        { key: 'end', label: 'End', render: (r) => <HrDateCell value={r.endDate} /> },
        {
          key: 'cap',
          label: 'Capacity',
          render: (r) =>
            r.maxParticipants != null ? (
              <span className="tabular-nums">{r.maxParticipants}</span>
            ) : (
              <span className="text-[var(--st-text-secondary)]">—</span>
            ),
        },
        {
          key: 'hours',
          label: 'Hours',
          render: (r) =>
            r.durationHours != null ? (
              <span className="tabular-nums">{r.durationHours}h</span>
            ) : (
              <span className="text-[var(--st-text-secondary)]">—</span>
            ),
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
