'use client';

import { Search } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import {
  getSavedSearches,
  saveSavedSearch,
  deleteSavedSearch,
} from '@/app/actions/worksuite/meta.actions';
import type { WsSavedSearch } from '@/lib/worksuite/meta-types';

function formatDate(value: unknown) {
  if (!value) return '—';
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export default function CrmSavedSearchesPage() {
  return (
    <HrEntityPage<WsSavedSearch & { _id: string }>
      title="Saved Searches"
      subtitle="Reusable search queries you've pinned across CRM modules."
      icon={Search}
      singular="Saved Search"
      getAllAction={getSavedSearches as any}
      saveAction={saveSavedSearch}
      deleteAction={deleteSavedSearch}
      rowOpensEditDialog
      columns={[
        { key: 'search_term', label: 'Search Term' },
        { key: 'module', label: 'Module' },
        { key: 'result_count', label: 'Results' },
        {
          key: 'last_used_at',
          label: 'Last Used',
          render: (row) => formatDate(row.last_used_at),
        },
      ]}
      fields={[
        { name: 'search_term', label: 'Search Term', required: true, fullWidth: true },
        {
          name: 'module',
          label: 'Module',
          required: true,
          type: 'select',
          options: [
            { value: 'contacts', label: 'Contacts' },
            { value: 'leads', label: 'Leads' },
            { value: 'deals', label: 'Deals' },
            { value: 'tasks', label: 'Tasks' },
            { value: 'tickets', label: 'Tickets' },
            { value: 'invoices', label: 'Invoices' },
            { value: 'projects', label: 'Projects' },
            { value: 'employees', label: 'Employees' },
          ],
        },
        { name: 'result_count', label: 'Result Count', type: 'number' },
      ]}
    />
  );
}
