'use client';

import { Tag } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import {
  getWsProjectLabels,
  saveWsProjectLabel,
  deleteWsProjectLabel,
} from '@/app/actions/worksuite/projects.actions';
import type { WsProjectLabelList } from '@/lib/worksuite/project-types';

export default function ProjectLabelsPage() {
  return (
    <HrEntityPage<WsProjectLabelList & { _id: string }>
      title="Project Labels"
      subtitle="Reusable labels you can assign to any project."
      icon={Tag}
      singular="Label"
      getAllAction={getWsProjectLabels as any}
      saveAction={saveWsProjectLabel}
      deleteAction={deleteWsProjectLabel}
      columns={[
        { key: 'labelName', label: 'Name' },
        {
          key: 'color',
          label: 'Color',
          render: (r) =>
            r.color ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full border border-border"
                  style={{ backgroundColor: r.color }}
                />
                {r.color}
              </span>
            ) : (
              '—'
            ),
        },
        { key: 'description', label: 'Description' },
      ]}
      fields={[
        {
          name: 'labelName',
          label: 'Label Name',
          required: true,
          fullWidth: true,
        },
        { name: 'color', label: 'Color (hex)', placeholder: '#2563eb' },
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
