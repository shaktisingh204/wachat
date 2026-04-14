'use client';

import { Activity } from 'lucide-react';
import { HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getWsProjectActivities,
  saveWsProjectActivity,
  deleteWsProjectActivity,
} from '@/app/actions/worksuite/projects.actions';
import type { WsProjectActivity } from '@/lib/worksuite/project-types';

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function ProjectActivityPage() {
  return (
    <HrEntityPage<WsProjectActivity & { _id: string }>
      title="Project Activity"
      subtitle="Timeline of what happened across your projects."
      icon={Activity}
      singular="Activity"
      getAllAction={getWsProjectActivities as any}
      saveAction={saveWsProjectActivity}
      deleteAction={deleteWsProjectActivity}
      columns={[
        { key: 'activity', label: 'Activity' },
        {
          key: 'projectId',
          label: 'Project',
          render: (r) => String(r.projectId || '—'),
        },
        { key: 'actorName', label: 'Actor' },
        {
          key: 'createdAt',
          label: 'When',
          render: (r) => fmtDate(r.createdAt),
        },
      ]}
      fields={[
        { name: 'projectId', label: 'Project ID', required: true },
        {
          name: 'activity',
          label: 'Activity',
          required: true,
          fullWidth: true,
          type: 'textarea',
        },
        { name: 'actorName', label: 'Actor Name' },
        { name: 'actorUserId', label: 'Actor User ID' },
      ]}
    />
  );
}
