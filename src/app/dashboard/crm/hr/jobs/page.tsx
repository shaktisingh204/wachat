'use client';

import { Briefcase } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getJobPostings,
  saveJobPosting,
  deleteJobPosting,
} from '@/app/actions/hr.actions';
import type { HrJobPosting } from '@/lib/hr-types';

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
      getAllAction={getJobPostings as any}
      saveAction={saveJobPosting}
      deleteAction={deleteJobPosting}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'department', label: 'Department' },
        { key: 'location', label: 'Location' },
        { key: 'employmentType', label: 'Type' },
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
        { name: 'title', label: 'Job Title', required: true, fullWidth: true },
        { name: 'department', label: 'Department' },
        { name: 'location', label: 'Location' },
        {
          name: 'employmentType',
          label: 'Employment Type',
          type: 'select',
          required: true,
          options: [
            { value: 'full-time', label: 'Full-time' },
            { value: 'part-time', label: 'Part-time' },
            { value: 'contract', label: 'Contract' },
            { value: 'internship', label: 'Internship' },
          ],
          defaultValue: 'full-time',
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          options: [
            { value: 'draft', label: 'Draft' },
            { value: 'open', label: 'Open' },
            { value: 'on-hold', label: 'On hold' },
            { value: 'closed', label: 'Closed' },
          ],
          defaultValue: 'draft',
        },
        { name: 'salaryMin', label: 'Salary (Min)', type: 'number' },
        { name: 'salaryMax', label: 'Salary (Max)', type: 'number' },
        { name: 'salaryCurrency', label: 'Currency', defaultValue: 'INR' },
        { name: 'applyUrl', label: 'Apply URL', fullWidth: true },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          fullWidth: true,
        },
        {
          name: 'requirements',
          label: 'Requirements',
          type: 'textarea',
          fullWidth: true,
        },
      ]}
    />
  );
}
