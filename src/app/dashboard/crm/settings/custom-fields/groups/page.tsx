'use client';

import { FolderTree } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../../hr/_components/hr-entity-page';
import {
  getCustomFieldGroups,
  saveCustomFieldGroup,
  deleteCustomFieldGroup,
} from '@/app/actions/worksuite/meta.actions';
import type { WsCustomFieldGroup } from '@/lib/worksuite/meta-types';

/** Manage groups — one group binds to a target entity type. */
export default function CustomFieldGroupsPage() {
  return (
    <HrEntityPage<WsCustomFieldGroup & { _id: string }>
      title="Custom Field Groups"
      subtitle="Each group attaches a set of custom fields to one target module."
      icon={FolderTree}
      singular="Group"
      getAllAction={getCustomFieldGroups as any}
      saveAction={saveCustomFieldGroup}
      deleteAction={deleteCustomFieldGroup}
      columns={[
        { key: 'name', label: 'Name' },
        {
          key: 'belongs_to',
          label: 'Target',
          render: (row) => (
            <ClayBadge tone="rose-soft">{String(row.belongs_to || '')}</ClayBadge>
          ),
        },
      ]}
      fields={[
        { name: 'name', label: 'Group name', required: true },
        {
          name: 'belongs_to',
          label: 'Applies to',
          type: 'select',
          required: true,
          options: [
            { value: 'contact', label: 'Contact' },
            { value: 'account', label: 'Account' },
            { value: 'client', label: 'Client' },
            { value: 'deal', label: 'Deal' },
            { value: 'lead', label: 'Lead' },
            { value: 'task', label: 'Task' },
            { value: 'project', label: 'Project' },
            { value: 'employee', label: 'Employee' },
            { value: 'invoice', label: 'Invoice' },
            { value: 'estimate', label: 'Estimate' },
            { value: 'ticket', label: 'Ticket' },
            { value: 'product', label: 'Product' },
            { value: 'vendor', label: 'Vendor' },
            { value: 'expense', label: 'Expense' },
          ],
        },
      ]}
    />
  );
}
