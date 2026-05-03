'use client';

import { Tags } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import {
  getWsTaskTags,
  saveWsTaskTag,
  deleteWsTaskTag,
} from '@/app/actions/worksuite/projects.actions';
import type { WsTaskTagList } from '@/lib/worksuite/project-types';

export default function TaskTagsPage() {
  return (
    <HrEntityPage<WsTaskTagList & { _id: string }>
      title="Task Tags"
      subtitle="Free-form tags for flexible task grouping."
      icon={Tags}
      singular="Task Tag"
      getAllAction={getWsTaskTags as any}
      saveAction={saveWsTaskTag}
      deleteAction={deleteWsTaskTag}
      columns={[
        { key: 'tagName', label: 'Name' },
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
      ]}
      fields={[
        { name: 'tagName', label: 'Tag Name', required: true, fullWidth: true },
        { name: 'color', label: 'Color (hex)', placeholder: '#d97706' },
      ]}
    />
  );
}
