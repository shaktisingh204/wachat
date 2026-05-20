'use client';

/**
 * Task Categories — settings-list with light Deep treatment.
 *
 * KPI · search/status filter · bulk delete · CSV/XLSX export ·
 * RowDrawer inline summary · inline-edit dialog · PaginationBar.
 *
 * Backed by the worksuite `crm_task_categories` collection through
 * `worksuite/projects.actions.ts`.
 */

import * as React from 'react';

import {
  SettingsDeepPage,
  type SettingsColumn,
} from '../../_components/settings-deep-page';
import {
  bulkDeleteWsTaskCategories,
  deleteWsTaskCategory,
  getWsTaskCategories,
  getWsTaskCategoryKpis,
  saveWsTaskCategory,
} from '@/app/actions/worksuite/projects.actions';
import type { WsTaskCategory } from '@/lib/worksuite/project-types';

type Row = Omit<WsTaskCategory, '_id' | 'userId' | 'createdAt' | 'updatedAt'> & {
  _id: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
};

const columns: SettingsColumn<Row>[] = [
  {
    key: 'categoryName',
    label: 'Name',
    exportValue: (r) => r.categoryName,
  },
];

export default function TaskCategoriesPage(): React.JSX.Element {
  return (
    <SettingsDeepPage<Row>
      title="Task Categories"
      subtitle="Categorise tasks across projects."
      singular="Category"
      drawerKind="Task Category"
      exportBaseName="task-categories"
      columns={columns}
      fields={[
        {
          name: 'categoryName',
          label: 'Category name',
          required: true,
          fullWidth: true,
          placeholder: 'e.g. Design',
        },
      ]}
      getAllAction={getWsTaskCategories as unknown as () => Promise<Row[]>}
      getKpisAction={getWsTaskCategoryKpis}
      saveAction={saveWsTaskCategory}
      deleteAction={deleteWsTaskCategory}
      bulkDeleteAction={bulkDeleteWsTaskCategories}
      displayName={(r) => r.categoryName ?? '—'}
      searchText={(r) => `${r.categoryName ?? ''}`}
    />
  );
}
