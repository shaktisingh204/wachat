'use client';

/**
 * Learning paths — list page rebuilt to §1D.1 bar.
 *
 * KPI strip: Total · Active · Avg steps · Total est. hours.
 * Server actions preserved: getLearningPaths / deleteLearningPath.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Route } from 'lucide-react';

import {
  getLearningPaths,
  deleteLearningPath,
} from '@/app/actions/hr.actions';
import type { HrLearningPath } from '@/lib/hr-types';

import {
  HrChip,
  HrListShell,
  HrStatusCell,
} from '../_components/hr-list-shell';

type Row = HrLearningPath & {
  _id: string;
  status?: string;
  assigned_to?: string;
  estimatedHours?: number;
  category?: string;
  difficulty?: string;
  isPublished?: string;
  prerequisites?: string;
};

export default function LearningPathsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = (await getLearningPaths()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const kpis = React.useMemo(() => {
    const total = rows.length;
    const active = rows.filter(
      (r) => String(r.status ?? '').toLowerCase() === 'active',
    ).length;
    const totalSteps = rows.reduce(
      (a, r) => a + (Array.isArray(r.steps) ? r.steps.length : 0),
      0,
    );
    const avgSteps = total ? Math.round(totalSteps / total) : 0;
    const totalHours = rows.reduce(
      (a, r) => a + (Number(r.estimatedHours) || 0),
      0,
    );
    return [
      { label: 'Total', value: total },
      { label: 'Active', value: active, tone: 'green' as const },
      { label: 'Avg steps', value: avgSteps, hint: 'Per path' },
      { label: 'Total est. hours', value: totalHours },
    ];
  }, [rows]);

  return (
    <HrListShell<Row>
      title="Learning paths"
      subtitle="Structured tracks with prerequisites, steps, and completion targets."
      icon={Route}
      newHref="/dashboard/hrm/hr/learning-paths/new"
      editHref={(r) => `/dashboard/hrm/hr/learning-paths/${r._id}/edit`}
      detailHref={(r) => `/dashboard/hrm/hr/learning-paths/${r._id}`}
      rows={rows}
      loading={isLoading}
      kpis={kpis}
      statusOptions={[
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ]}
      getRowStatus={(r) => String(r.status ?? '')}
      searchPlaceholder="Search paths…"
      searchPredicate={(r, q) =>
        String(r.name ?? '').toLowerCase().includes(q) ||
        String(r.category ?? '').toLowerCase().includes(q)
      }
      onDelete={deleteLearningPath}
      onAfterChange={refresh}
      emptyText="No learning paths yet"
      columns={[
        {
          key: 'name',
          label: 'Title',
          render: (r) => (
            <span className="block max-w-[220px] truncate font-medium">{r.name}</span>
          ),
        },
        {
          key: 'steps',
          label: 'Steps',
          render: (r) => (
            <span className="tabular-nums">
              {Array.isArray(r.steps) ? r.steps.length : 0}
            </span>
          ),
        },
        {
          key: 'prereq',
          label: 'Prerequisites',
          render: (r) => (
            <span className="block max-w-[180px] truncate text-[var(--st-text-secondary)]">
              {r.prerequisites || '—'}
            </span>
          ),
        },
        {
          key: 'category',
          label: 'Category',
          render: (r) => (r.category ? <HrChip>{r.category}</HrChip> : <span className="text-[var(--st-text-secondary)]">—</span>),
        },
        {
          key: 'difficulty',
          label: 'Difficulty',
          render: (r) => (r.difficulty ? <HrChip>{r.difficulty}</HrChip> : <span className="text-[var(--st-text-secondary)]">—</span>),
        },
        {
          key: 'hours',
          label: 'Hours',
          render: (r) =>
            r.estimatedHours != null ? (
              <span className="tabular-nums">{r.estimatedHours}h</span>
            ) : (
              <span className="text-[var(--st-text-secondary)]">—</span>
            ),
        },
        {
          key: 'assigned',
          label: 'Assigned',
          render: (r) =>
            r.assigned_to ? (
              <span className="block max-w-[120px] truncate text-[var(--st-text-secondary)]">
                {r.assigned_to}
              </span>
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
