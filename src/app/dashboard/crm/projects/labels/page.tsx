'use client';

/**
 * Project Labels — taxonomy lookup (§1D).
 * KPI (total / with color / recent 7d) · search + color filter · bulk
 * delete + bulk export · RowDrawer · PaginationBar.
 */

import { Tag } from 'lucide-react';
import { TaxonomyLookupPage } from '../_components/taxonomy-lookup-page';
import {
  getWsProjectLabels,
  saveWsProjectLabel,
  deleteWsProjectLabel,
  bulkDeleteWsProjectLabels,
} from '@/app/actions/worksuite/projects.actions';
import type { WsProjectLabelList } from '@/lib/worksuite/project-types';

type Row = WsProjectLabelList & { _id: string };

function getContrastYIQ(hexcolor: string) {
  if (!hexcolor) return 'inherit';
  const hex = hexcolor.replace('#', '');
  if (hex.length !== 6 && hex.length !== 3) return 'inherit';
  const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substr(0, 2), 16);
  const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substr(2, 2), 16);
  const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

export default function ProjectLabelsPage() {
  return (
    <TaxonomyLookupPage<Row>
      title="Project Labels"
      subtitle="Reusable labels you can assign to any project."
      icon={Tag}
      singular="Label"
      nameKey="labelName"
      hasColor
      exportFilenameStem="project-labels"
      getList={() => getWsProjectLabels() as unknown as Promise<Row[]>}
      saveAction={saveWsProjectLabel}
      deleteAction={deleteWsProjectLabel}
      bulkDelete={bulkDeleteWsProjectLabels}
      columns={[
        {
          key: 'labelName',
          label: 'Name',
          render: (r) => (
            <span
              className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md border border-zoru-line"
              style={{
                backgroundColor: r.color || 'transparent',
                color: r.color ? getContrastYIQ(r.color) : 'inherit',
              }}
            >
              {r.labelName}
            </span>
          )
        },
        {
          key: 'color',
          label: 'Color',
          render: (r) =>
            r.color ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full border border-zoru-line"
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
        { name: 'labelName', label: 'Label name', required: true, fullWidth: true },
        { name: 'color', label: 'Color (hex)', type: 'color', placeholder: '#2563eb' },
        { name: 'description', label: 'Description', type: 'textarea', fullWidth: true },
      ]}
    />
  );
}
