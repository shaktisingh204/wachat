'use client';

import { Route } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getLearningPaths,
  saveLearningPath,
  deleteLearningPath,
} from '@/app/actions/hr.actions';
import type { HrLearningPath } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'green' | 'neutral'> = {
  active: 'green',
  inactive: 'neutral',
};

export default function LearningPathsPage() {
  return (
    <HrEntityPage<HrLearningPath & { _id: string }>
      title="Learning Paths"
      subtitle="Structured learning tracks — assign courses and set estimated hours."
      icon={Route}
      singular="Path"
      basePath="/dashboard/hrm/hr/learning-paths"
      getAllAction={getLearningPaths as any}
      saveAction={saveLearningPath}
      deleteAction={deleteLearningPath}
      columns={[
        {
          key: 'name',
          label: 'Title',
          render: (row) => (
            <span className="block max-w-[220px] truncate font-medium">
              {(row as any).name || '—'}
            </span>
          ),
        },
        {
          key: 'assigned_to',
          label: 'Assigned To',
          render: (row) => {
            const v = (row as any).assigned_to;
            return v ? (
              <span className="block max-w-[140px] truncate text-muted-foreground">{v}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
        },
        {
          key: 'estimatedHours',
          label: 'Est. Hours',
          render: (row) => {
            const h = (row as any).estimatedHours ?? (row as any).estimatedDuration;
            return h != null ? (
              <span className="tabular-nums">{h}{typeof h === 'number' ? 'h' : ''}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
        },
        {
          key: 'steps',
          label: 'Courses',
          render: (row) => {
            const s = (row as any).steps;
            const count = Array.isArray(s) ? s.length : 0;
            return (
              <span className="tabular-nums text-muted-foreground">{count}</span>
            );
          },
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => {
            const s = (row as any).status;
            if (!s) return <span className="text-muted-foreground">—</span>;
            return (
              <ClayBadge tone={STATUS_TONES[s] ?? 'neutral'} dot>
                {s}
              </ClayBadge>
            );
          },
        },
      ]}
      fields={fields}
    />
  );
}
