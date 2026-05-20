'use client';

/** Task Tags — free-form tag taxonomy lookup (§1D). */

import { Tags } from 'lucide-react';
import { TaxonomyLookupPage } from '../_components/taxonomy-lookup-page';
import {
  getWsTaskTags,
  saveWsTaskTag,
  deleteWsTaskTag,
  bulkDeleteWsTaskTags,
} from '@/app/actions/worksuite/projects.actions';
import type { WsTaskTagList } from '@/lib/worksuite/project-types';

type Row = WsTaskTagList & { _id: string };

export default function TaskTagsPage() {
  return (
    <TaxonomyLookupPage<Row>
      title="Task Tags"
      subtitle="Free-form tags for flexible task grouping."
      icon={Tags}
      singular="Task Tag"
      nameKey="tagName"
      hasColor
      exportFilenameStem="task-tags"
      getList={() => getWsTaskTags() as unknown as Promise<Row[]>}
      saveAction={saveWsTaskTag}
      deleteAction={deleteWsTaskTag}
      bulkDelete={bulkDeleteWsTaskTags}
      columns={[
        { key: 'tagName', label: 'Name' },
        {
          key: 'color',
          label: 'Color',
          render: (r) =>
            r.color ? <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-zoru-line" style={{ backgroundColor: r.color }} />{r.color}</span> : '—',
        },
      ]}
      fields={[
        { name: 'tagName', label: 'Tag name', required: true, fullWidth: true },
        { name: 'color', label: 'Color (hex)', type: 'color', placeholder: '#d97706' },
      ]}
    />
  );
}
