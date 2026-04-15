'use client';

import { Tag } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import {
  getWsTaskLabels,
  saveWsTaskLabel,
  deleteWsTaskLabel,
} from '@/app/actions/worksuite/projects.actions';
import type { WsTaskLabelList } from '@/lib/worksuite/project-types';

export default function TaskLabelsPage() {
  return (
    <HrEntityPage<WsTaskLabelList & { _id: string }>
      title="Task Labels"
      subtitle="Reusable labels to tag individual tasks."
      icon={Tag}
      singular="Task Label"
      getAllAction={getWsTaskLabels as any}
      saveAction={saveWsTaskLabel}
      deleteAction={deleteWsTaskLabel}
      columns={[
        { key: 'labelName', label: 'Name' },
        {
          key: 'color',
          label: 'Color',
          render: (r) =>
            r.color ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full border border-clay-border"
                  style={{ backgroundColor: r.color }}
                />
                {r.color}
              </span>
            ) : (
              '—'
            ),
        },
        {
          key: 'projectId',
          label: 'Project (optional)',
          render: (r) => String(r.projectId || '—'),
        },
      ]}
      fields={[
        {
          name: 'labelName',
          label: 'Label Name',
          required: true,
          fullWidth: true,
        },
        { name: 'color', label: 'Color (hex)', placeholder: '#059669' },
        { name: 'projectId', label: 'Project ID (optional)' },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          fullWidth: true,
        },
      ]}
    />
  );
}
