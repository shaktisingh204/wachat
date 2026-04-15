'use client';

import { Tags } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../_components/hr-entity-page';
import {
  getLeadCategories,
  saveLeadCategory,
  deleteLeadCategory,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadCategory } from '@/lib/worksuite/crm-types';

export default function LeadCategoriesPage() {
  return (
    <HrEntityPage<WsLeadCategory & { _id: string }>
      title="Lead Categories"
      subtitle="Group leads by line-of-business or product family."
      icon={Tags}
      singular="Category"
      getAllAction={getLeadCategories as any}
      saveAction={saveLeadCategory}
      deleteAction={deleteLeadCategory}
      columns={[
        { key: 'category_name', label: 'Category' },
        {
          key: 'is_default',
          label: 'Default',
          render: (row) => {
            const isDefault =
              row.is_default === true ||
              (row.is_default as unknown as string) === 'true' ||
              (row.is_default as unknown as string) === 'yes';
            return (
              <ClayBadge tone={isDefault ? 'amber' : 'neutral'}>
                {isDefault ? 'Yes' : 'No'}
              </ClayBadge>
            );
          },
        },
      ]}
      fields={[
        {
          name: 'category_name',
          label: 'Category Name',
          required: true,
          fullWidth: true,
        },
        {
          name: 'is_default',
          label: 'Default',
          type: 'select',
          options: [
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ],
          defaultValue: 'no',
        },
      ]}
    />
  );
}
