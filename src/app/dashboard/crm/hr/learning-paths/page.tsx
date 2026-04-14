'use client';

import { Route } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getLearningPaths,
  saveLearningPath,
  deleteLearningPath,
} from '@/app/actions/hr.actions';
import type { HrLearningPath } from '@/lib/hr-types';

export default function LearningPathsPage() {
  return (
    <HrEntityPage<HrLearningPath & { _id: string }>
      title="Learning Paths"
      subtitle="Structured learning tracks with ordered steps and resources."
      icon={Route}
      singular="Path"
      getAllAction={getLearningPaths as any}
      saveAction={saveLearningPath}
      deleteAction={deleteLearningPath}
      columns={[
        { key: 'name', label: 'Name' },
        {
          key: 'description',
          label: 'Description',
          render: (row) => (
            <span className="block max-w-[320px] truncate">
              {row.description || '—'}
            </span>
          ),
        },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, fullWidth: true },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          fullWidth: true,
        },
        {
          name: 'steps',
          label: 'Steps (JSON array)',
          type: 'textarea',
          fullWidth: true,
          placeholder: '[{"title":"Intro","link":"https://..."}]',
        },
      ]}
    />
  );
}
