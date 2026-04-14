'use client';

import { BookOpen } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getTrainingPrograms,
  saveTrainingProgram,
  deleteTrainingProgram,
} from '@/app/actions/hr.actions';
import type { HrTrainingProgram } from '@/lib/hr-types';

const STATUS_TONES: Record<string, 'neutral' | 'amber' | 'blue' | 'green'> = {
  draft: 'neutral',
  scheduled: 'amber',
  running: 'blue',
  completed: 'green',
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
      subtitle="Learning sessions, workshops, and scheduled cohorts."
      icon={BookOpen}
      singular="Program"
      getAllAction={getTrainingPrograms as any}
      saveAction={saveTrainingProgram}
      deleteAction={deleteTrainingProgram}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'trainer', label: 'Trainer' },
        {
          key: 'startDate',
          label: 'Start Date',
          render: (row) => <span>{formatDate(row.startDate)}</span>,
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <ClayBadge tone={STATUS_TONES[row.status] || 'neutral'} dot>
              {row.status}
            </ClayBadge>
          ),
        },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, fullWidth: true },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          fullWidth: true,
        },
        { name: 'trainer', label: 'Trainer' },
        { name: 'duration', label: 'Duration' },
        { name: 'startDate', label: 'Start Date', type: 'date' },
        { name: 'endDate', label: 'End Date', type: 'date' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'draft', label: 'Draft' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'running', label: 'Running' },
            { value: 'completed', label: 'Completed' },
          ],
          defaultValue: 'draft',
        },
      ]}
    />
  );
}
