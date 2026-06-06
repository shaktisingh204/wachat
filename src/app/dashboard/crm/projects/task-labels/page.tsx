'use client';

/**
 * Task Labels — taxonomy lookup (§1D).
 * Reusable labels to tag individual tasks (optionally project-scoped).
 *
 * KPI (total / with color / recent 7d) · search + color filter · bulk
 * delete + bulk export · RowDrawer · PaginationBar.
 */

import { Tag } from 'lucide-react';
import { TaxonomyLookupPage } from '../_components/taxonomy-lookup-page';
import {
  getWsTaskLabels,
  saveWsTaskLabel,
  deleteWsTaskLabel,
  bulkDeleteWsTaskLabels,
} from '@/app/actions/worksuite/projects.actions';
import type { WsTaskLabelList } from '@/lib/worksuite/project-types';

type Row = WsTaskLabelList & { _id: string };

export default function TaskLabelsPage() {
  return (
    <TaxonomyLookupPage<Row>
      title="Task Labels"
      subtitle="Reusable labels to tag individual tasks."
      icon={Tag}
      singular="Task Label"
      nameKey="labelName"
      hasColor
      exportFilenameStem="task-labels"
      getList={() => getWsTaskLabels() as unknown as Promise<Row[]>}
      saveAction={saveWsTaskLabel}
      deleteAction={deleteWsTaskLabel}
      bulkDelete={bulkDeleteWsTaskLabels}
      columns={[
        { key: 'labelName', label: 'Name' },
        {
          key: 'color',
          label: 'Color',
          render: (r) =>
            r.color ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full border border-[var(--st-border)]"
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
          render: (r) => (r.projectId ? String(r.projectId) : '—'),
        },
        { key: 'description', label: 'Description' },
      ]}
      fields={[
        { name: 'labelName', label: 'Label name', required: true, fullWidth: true },
        { name: 'color', label: 'Color (hex)', type: 'color', placeholder: '#059669' },
        { name: 'projectId', label: 'Project ID (optional)', placeholder: 'ObjectId' },
        { name: 'description', label: 'Description', type: 'textarea', fullWidth: true },
      ]}
    />
  );
}
