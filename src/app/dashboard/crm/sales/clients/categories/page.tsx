'use client';

import * as React from 'react';
import { Tags, Layers } from 'lucide-react';
import { HrEntityPage } from '../../../hr/_components/hr-entity-page';
import {
  getClientCategories,
  saveClientCategory,
  deleteClientCategory,
  getClientSubCategories,
  saveClientSubCategory,
  deleteClientSubCategory,
} from '@/app/actions/worksuite/crm-plus.actions';
import type {
  WsClientCategory,
  WsClientSubCategory,
} from '@/lib/worksuite/crm-types';

export default function ClientCategoriesPage() {
  const [categories, setCategories] = React.useState<WsClientCategory[]>([]);

  React.useEffect(() => {
    (async () => {
      const list = await getClientCategories();
      setCategories(list as unknown as WsClientCategory[]);
    })();
  }, []);

  const categoryOptions = categories.map((c) => ({
    value: String(c._id),
    label: c.category_name,
  }));
  const categoryLookup = new Map(
    categoryOptions.map((o) => [o.value, o.label]),
  );

  return (
    <div className="flex flex-col gap-10">
      <HrEntityPage<WsClientCategory & { _id: string }>
        title="Client Categories"
        subtitle="Top-level grouping for client accounts."
        icon={Tags}
        singular="Category"
        getAllAction={getClientCategories as any}
        saveAction={saveClientCategory}
        deleteAction={deleteClientCategory}
        columns={[{ key: 'category_name', label: 'Category' }]}
        fields={[
          {
            name: 'category_name',
            label: 'Category Name',
            required: true,
            fullWidth: true,
          },
        ]}
      />

      <HrEntityPage<WsClientSubCategory & { _id: string }>
        title="Client Sub-Categories"
        subtitle="Refine each category with sub-classifications."
        icon={Layers}
        singular="Sub-Category"
        getAllAction={getClientSubCategories as any}
        saveAction={saveClientSubCategory}
        deleteAction={deleteClientSubCategory}
        columns={[
          { key: 'name', label: 'Sub-Category' },
          {
            key: 'client_category_id',
            label: 'Parent Category',
            render: (row) =>
              categoryLookup.get(String(row.client_category_id)) || '—',
          },
        ]}
        fields={[
          {
            name: 'client_category_id',
            label: 'Parent Category',
            type: 'select',
            required: true,
            options: categoryOptions,
          },
          { name: 'name', label: 'Sub-Category Name', required: true },
        ]}
      />
    </div>
  );
}
