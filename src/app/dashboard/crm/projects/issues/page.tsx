'use client';

import { Bug } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getWsIssues,
  saveWsIssue,
  deleteWsIssue,
} from '@/app/actions/worksuite/projects.actions';
import type { WsIssue } from '@/lib/worksuite/project-types';

const STATUS_TONES: Record<string, 'neutral' | 'amber' | 'green' | 'red' | 'blue'> = {
  open: 'amber',
  in_progress: 'blue',
  resolved: 'green',
  closed: 'neutral',
};

const PRIORITY_TONES: Record<string, 'neutral' | 'blue' | 'amber' | 'red'> = {
  low: 'neutral',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
};

export default function ProjectIssuesPage() {
  return (
    <HrEntityPage<WsIssue & { _id: string }>
      title="Issues"
      subtitle="Track bugs, blockers and incidents against your projects."
      icon={Bug}
      singular="Issue"
      getAllAction={getWsIssues as any}
      saveAction={saveWsIssue}
      deleteAction={deleteWsIssue}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'projectId', label: 'Project', render: (r) => String(r.projectId || '—') },
        {
          key: 'status',
          label: 'Status',
          render: (r) => (
            <ClayBadge tone={STATUS_TONES[r.status] || 'neutral'} dot>
              {r.status}
            </ClayBadge>
          ),
        },
        {
          key: 'priority',
          label: 'Priority',
          render: (r) =>
            r.priority ? (
              <ClayBadge tone={PRIORITY_TONES[r.priority] || 'neutral'} dot>
                {r.priority}
              </ClayBadge>
            ) : (
              '—'
            ),
        },
        { key: 'reporterName', label: 'Reporter' },
        { key: 'assigneeName', label: 'Assignee' },
      ]}
      fields={[
        { name: 'title', label: 'Title', required: true, fullWidth: true },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          fullWidth: true,
        },
        { name: 'projectId', label: 'Project ID' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          options: [
            { value: 'open', label: 'Open' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'closed', label: 'Closed' },
          ],
          defaultValue: 'open',
        },
        {
          name: 'priority',
          label: 'Priority',
          type: 'select',
          options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' },
          ],
          defaultValue: 'medium',
        },
        { name: 'reporterName', label: 'Reporter' },
        { name: 'assigneeName', label: 'Assignee' },
      ]}
    />
  );
}
