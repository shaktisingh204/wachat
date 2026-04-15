'use client';

import { FolderOpen } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import {
  getWsTaskCategories,
  saveWsTaskCategory,
  deleteWsTaskCategory,
} from '@/app/actions/worksuite/projects.actions';
import type { WsTaskCategory } from '@/lib/worksuite/project-types';

export default function TaskCategoriesPage() {
  return (
    <HrEntityPage<WsTaskCategory & { _id: string }>
      title="Task Categories"
      subtitle="Categorise tasks across projects."
      icon={FolderOpen}
      singular="Task Category"
      getAllAction={getWsTaskCategories as any}
      saveAction={saveWsTaskCategory}
      deleteAction={deleteWsTaskCategory}
      columns={[{ key: 'categoryName', label: 'Name' }]}
      fields={[
        {
          name: 'categoryName',
          label: 'Category Name',
          required: true,
          fullWidth: true,
        },
      ]}
    />
  );
}
