'use client';

import { Briefcase } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getJobPostings,
  saveJobPosting,
  deleteJobPosting,
} from '@/app/actions/hr.actions';
import type { HrJobPosting } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  draft: 'neutral',
  open: 'green',
  'on-hold': 'amber',
  closed: 'red',
};

export default function JobsPage() {
  return (
    <HrEntityPage<HrJobPosting & { _id: string }>
      title="Job Postings"
      subtitle="Open roles, JDs, and hiring pipelines."
      icon={Briefcase}
      singular="Job"
      basePath="/dashboard/hrm/hr/jobs"
      getAllAction={getJobPostings as any}
      saveAction={saveJobPosting}
      deleteAction={deleteJobPosting}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'departmentId', label: 'Department' },
        { key: 'location', label: 'Location' },
        { key: 'employmentType', label: 'Type' },
        { key: 'totalOpenings', label: 'Openings' },
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
