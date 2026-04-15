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

const RESULT_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  pending: 'amber',
  passed: 'green',
  failed: 'red',
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
        { key: 'type', label: 'Type' },
        {
          key: 'result',
          label: 'Result',
          render: (row) => (
            <ClayBadge tone={RESULT_TONES[(row as any).result] || 'neutral'} dot>
              {(row as any).result || 'pending'}
            </ClayBadge>
          ),
        },
      ]}
      fields={fields}
    />
  );
}
