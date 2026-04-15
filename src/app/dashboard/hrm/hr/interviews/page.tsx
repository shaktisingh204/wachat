'use client';

import { Calendar } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getInterviews,
  saveInterview,
  deleteInterview,
} from '@/app/actions/hr.actions';
import type { HrInterview } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  scheduled: 'amber',
  completed: 'green',
  cancelled: 'neutral',
  'no-show': 'red',
  rescheduled: 'amber',
};

export default function InterviewsPage() {
  return (
    <HrEntityPage<HrInterview & { _id: string }>
      title="Interviews"
      subtitle="Schedule rounds, panel feedback, and recommendations."
      icon={Calendar}
      singular="Interview"
      basePath="/dashboard/hrm/hr/interviews"
      getAllAction={getInterviews as any}
      saveAction={saveInterview}
      deleteAction={deleteInterview}
      columns={[
        { key: 'interviewerName', label: 'Interviewer' },
        { key: 'roundNumber', label: 'Round' },
        {
          key: 'scheduledAt',
          label: 'Scheduled',
          render: (row) =>
            row.scheduledAt
              ? new Date(row.scheduledAt).toLocaleDateString()
              : '—',
        },
        { key: 'mode', label: 'Mode' },
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
      fields={fields}
    />
  );
}
