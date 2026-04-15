'use client';

import { Tags } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import {
  getExpenseCategoriesExt,
  saveExpenseCategoryExt,
  deleteExpenseCategoryExt,
} from '@/app/actions/worksuite/meta.actions';
import type { WsExpenseCategoryExt } from '@/lib/worksuite/meta-types';

/**
 * Expense categories — lightweight label dictionary used when
 * classifying expenses. (Separate from the accounting chart.)
 */
export default function ExpenseCategoriesPage() {
  return (
    <HrEntityPage<WsExpenseCategoryExt & { _id: string }>
      title="Expense Categories"
      subtitle="Named buckets used to classify expense records."
      icon={Tags}
      singular="Category"
      getAllAction={getExpenseCategoriesExt as any}
      saveAction={saveExpenseCategoryExt}
      deleteAction={deleteExpenseCategoryExt}
      columns={[
        { key: 'category_name', label: 'Name' },
        { key: 'description', label: 'Description' },
      ]}
      fields={[
        { name: 'category_name', label: 'Category', required: true },
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
