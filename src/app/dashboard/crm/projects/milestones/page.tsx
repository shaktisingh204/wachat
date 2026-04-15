'use client';

import { Flag } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../_components/hr-entity-page';
import {
  getWsProjectMilestones,
  saveWsProjectMilestone,
  deleteWsProjectMilestone,
} from '@/app/actions/worksuite/projects.actions';
import type { WsProjectMilestone } from '@/lib/worksuite/project-types';

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ProjectMilestonesPage() {
  return (
    <HrEntityPage<WsProjectMilestone & { _id: string }>
      title="Milestones"
      subtitle="All project milestones across every project."
      icon={Flag}
      singular="Milestone"
      getAllAction={getWsProjectMilestones as any}
      saveAction={saveWsProjectMilestone}
      deleteAction={deleteWsProjectMilestone}
      columns={[
        { key: 'milestoneTitle', label: 'Title' },
        { key: 'projectId', label: 'Project', render: (r) => String(r.projectId) },
        { key: 'startDate', label: 'Start', render: (r) => fmtDate(r.startDate) },
        { key: 'endDate', label: 'End', render: (r) => fmtDate(r.endDate) },
        {
          key: 'cost',
          label: 'Cost',
          render: (r) => (r.cost ? `${r.currency || 'INR'} ${r.cost}` : '—'),
        },
        {
          key: 'status',
          label: 'Status',
          render: (r) => (
            <ClayBadge tone={r.status === 'complete' ? 'green' : 'amber'} dot>
              {r.status}
            </ClayBadge>
          ),
        },
      ]}
      fields={[
        { name: 'projectId', label: 'Project ID', required: true },
        {
          name: 'milestoneTitle',
          label: 'Title',
          required: true,
          fullWidth: true,
        },
        { name: 'summary', label: 'Summary', type: 'textarea', fullWidth: true },
        { name: 'cost', label: 'Cost', type: 'number' },
        { name: 'currency', label: 'Currency', defaultValue: 'INR' },
        { name: 'startDate', label: 'Start Date', type: 'date' },
        { name: 'endDate', label: 'End Date', type: 'date' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'incomplete', label: 'Incomplete' },
            { value: 'complete', label: 'Complete' },
          ],
          defaultValue: 'incomplete',
        },
      ]}
    />
  );
}
