'use client';

/** Project Categories + Sub-categories — stacked taxonomy lookups (§1D). */

import * as React from 'react';
import { FolderOpen, Layers } from 'lucide-react';
import { TaxonomyLookupPage } from '../_components/taxonomy-lookup-page';
import {
  getWsProjectCategories,
  saveWsProjectCategory,
  deleteWsProjectCategory,
  bulkDeleteWsProjectCategories,
  getWsProjectSubCategories,
  saveWsProjectSubCategory,
  deleteWsProjectSubCategory,
  bulkDeleteWsProjectSubCategories,
} from '@/app/actions/worksuite/projects.actions';
import type {
  WsProjectCategory,
  WsProjectSubCategory,
} from '@/lib/worksuite/project-types';

type CatRow = WsProjectCategory & { _id: string };
type SubRow = WsProjectSubCategory & { _id: string };

export default function ProjectCategoriesPage() {
  const [parentNames, setParentNames] = React.useState<Map<string, string>>(new Map());

  const loadCats = React.useCallback(async () => {
    const list = (await getWsProjectCategories()) as CatRow[];
    setParentNames(new Map(list.map((c) => [c._id, c.categoryName])));
    return list;
  }, []);

  return (
    <div className="flex w-full flex-col gap-8">
      <TaxonomyLookupPage<CatRow>
        title="Project Categories"
        subtitle="Group projects by category."
        icon={FolderOpen}
        singular="Category"
        nameKey="categoryName"
        exportFilenameStem="project-categories"
        getList={loadCats}
        saveAction={saveWsProjectCategory}
        deleteAction={deleteWsProjectCategory}
        bulkDelete={bulkDeleteWsProjectCategories}
        columns={[
          { key: 'categoryName', label: 'Name' },
          { key: 'description', label: 'Description' },
        ]}
        fields={[
          { name: 'categoryName', label: 'Category name', required: true, fullWidth: true },
          { name: 'description', label: 'Description', type: 'textarea', fullWidth: true },
        ]}
      />

      <TaxonomyLookupPage<SubRow>
        title="Project Sub-Categories"
        subtitle="Sub-taxonomy under project categories."
        icon={Layers}
        singular="Sub-Category"
        nameKey="categoryName"
        exportFilenameStem="project-sub-categories"
        getList={() => getWsProjectSubCategories() as unknown as Promise<SubRow[]>}
        saveAction={saveWsProjectSubCategory}
        deleteAction={deleteWsProjectSubCategory}
        bulkDelete={bulkDeleteWsProjectSubCategories}
        columns={[
          { key: 'categoryName', label: 'Name' },
          {
            key: 'parentCategoryId',
            label: 'Parent',
            render: (r) =>
              r.parentCategoryId
                ? parentNames.get(String(r.parentCategoryId)) ?? String(r.parentCategoryId)
                : '—',
          },
          { key: 'description', label: 'Description' },
        ]}
        fields={[
          { name: 'categoryName', label: 'Sub-category name', required: true, fullWidth: true },
          { name: 'parentCategoryId', label: 'Parent category ID', placeholder: 'ObjectId' },
          { name: 'description', label: 'Description', type: 'textarea', fullWidth: true },
        ]}
      />
    </div>
  );
}
