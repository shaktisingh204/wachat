'use client';

import { Calendar } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getInterviews,
  saveInterview,
  deleteInterview,
} from '@/app/actions/hr.actions';
import type { HrInterview } from '@/lib/hr-types';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  scheduled: 'amber',
  completed: 'green',
  cancelled: 'neutral',
  'no-show': 'red',
};

export default function InterviewsPage() {
  return (
    <HrEntityPage<HrInterview & { _id: string }>
      title="Interviews"
      subtitle="Schedule rounds, panel feedback, and recommendations."
      icon={Calendar}
      singular="Interview"
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
      fields={[
        { name: 'candidateId', label: 'Candidate ID' },
        { name: 'roundNumber', label: 'Round Number', type: 'number' },
        { name: 'interviewerName', label: 'Interviewer Name' },
        {
          name: 'scheduledAt',
          label: 'Scheduled At',
          type: 'date',
          required: true,
        },
        {
          name: 'mode',
          label: 'Mode',
          type: 'select',
          required: true,
          options: [
            { value: 'in-person', label: 'In-person' },
            { value: 'phone', label: 'Phone' },
            { value: 'video', label: 'Video' },
          ],
          defaultValue: 'video',
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          options: [
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'no-show', label: 'No-show' },
          ],
          defaultValue: 'scheduled',
        },
        {
          name: 'recommendation',
          label: 'Recommendation',
          type: 'select',
          options: [
            { value: 'strong-hire', label: 'Strong hire' },
            { value: 'hire', label: 'Hire' },
            { value: 'no-hire', label: 'No hire' },
            { value: 'strong-no-hire', label: 'Strong no hire' },
          ],
        },
        {
          name: 'feedback',
          label: 'Feedback',
          type: 'textarea',
          fullWidth: true,
        },
      ]}
    />
  );
}
