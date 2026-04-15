'use client';

import { FolderOpen, Layers } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import {
  getWsProjectCategories,
  saveWsProjectCategory,
  deleteWsProjectCategory,
  getWsProjectSubCategories,
  saveWsProjectSubCategory,
  deleteWsProjectSubCategory,
} from '@/app/actions/worksuite/projects.actions';
import type {
  WsProjectCategory,
  WsProjectSubCategory,
} from '@/lib/worksuite/project-types';

export default function ProjectCategoriesPage() {
  return (
    <div className="flex w-full flex-col gap-8">
      <HrEntityPage<WsProjectCategory & { _id: string }>
        title="Project Categories"
        subtitle="Group projects by category."
        icon={FolderOpen}
        singular="Category"
        getAllAction={getWsProjectCategories as any}
        saveAction={saveWsProjectCategory}
        deleteAction={deleteWsProjectCategory}
        columns={[
          { key: 'categoryName', label: 'Name' },
          { key: 'description', label: 'Description' },
        ]}
        fields={[
          {
            name: 'categoryName',
            label: 'Category Name',
            required: true,
            fullWidth: true,
          },
          {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            fullWidth: true,
          },
        ]}
      />

      <HrEntityPage<WsProjectSubCategory & { _id: string }>
        title="Project Sub-Categories"
        subtitle="Sub-taxonomy under project categories."
        icon={Layers}
        singular="Sub-Category"
        getAllAction={getWsProjectSubCategories as any}
        saveAction={saveWsProjectSubCategory}
        deleteAction={deleteWsProjectSubCategory}
        columns={[
          { key: 'categoryName', label: 'Name' },
          {
            key: 'parentCategoryId',
            label: 'Parent Category',
            render: (r) => String(r.parentCategoryId || '—'),
          },
        ]}
        fields={[
          {
            name: 'categoryName',
            label: 'Sub-Category Name',
            required: true,
            fullWidth: true,
          },
          { name: 'parentCategoryId', label: 'Parent Category ID' },
          {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            fullWidth: true,
          },
        ]}
      />
    </div>
  );
}
