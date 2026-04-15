'use client';

import { BookOpen } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getTrainingPrograms,
  saveTrainingProgram,
  deleteTrainingProgram,
} from '@/app/actions/hr.actions';
import type { HrTrainingProgram } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'amber' | 'blue' | 'green' | 'red'> = {
  draft: 'neutral',
  upcoming: 'amber',
  scheduled: 'amber',
  ongoing: 'blue',
  running: 'blue',
  completed: 'green',
  cancelled: 'red',
};

function formatDate(value: unknown) {
  if (!value) return '—';
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

export default function TrainingPage() {
  return (
    <HrEntityPage<HrTrainingProgram & { _id: string }>
      title="Training Programs"
      subtitle="Online, classroom, and on-the-job learning sessions."
      icon={BookOpen}
      singular="Program"
      basePath="/dashboard/hrm/hr/training"
      getAllAction={getTrainingPrograms as any}
      saveAction={saveTrainingProgram}
      deleteAction={deleteTrainingProgram}
      columns={[
        {
          key: 'name',
          label: 'Title',
          render: (row) => (
            <span className="block max-w-[200px] truncate font-medium">
              {(row as any).name || '—'}
            </span>
          ),
        },
        {
          key: 'format',
          label: 'Type',
          render: (row) => {
            const t = (row as any).format ?? (row as any).category;
            return t ? (
              <ClayBadge tone="neutral">{t}</ClayBadge>
            ) : (
              <span className="text-clay-ink-muted">—</span>
            );
          },
        },
        { key: 'trainer', label: 'Trainer' },
        {
          key: 'startDate',
          label: 'Start Date',
          render: (row) => <span>{formatDate((row as any).startDate)}</span>,
        },
        {
          key: 'endDate',
          label: 'End Date',
          render: (row) => <span>{formatDate((row as any).endDate)}</span>,
        },
        {
          key: 'durationHours',
          label: 'Hours',
          render: (row) => {
            const h = (row as any).durationHours;
            return h != null ? (
              <span className="tabular-nums">{h}h</span>
            ) : (
              <span className="text-clay-ink-muted">—</span>
            );
          },
        },
        {
          key: 'maxParticipants',
          label: 'Max',
          render: (row) => {
            const m = (row as any).maxParticipants;
            return m != null ? (
              <span className="tabular-nums">{m}</span>
            ) : (
              <span className="text-clay-ink-muted">—</span>
            );
          },
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <ClayBadge tone={STATUS_TONES[row.status] ?? 'neutral'} dot>
              {row.status}
            </ClayBadge>
          ),
        },
      ]}
      fields={fields}
    />
  );
}
