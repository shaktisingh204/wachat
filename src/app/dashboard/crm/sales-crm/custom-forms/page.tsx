'use client';

import { FormInput } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../_components/hr-entity-page';
import {
  getLeadCustomForms,
  saveLeadCustomForm,
  deleteLeadCustomForm,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadCustomForm } from '@/lib/worksuite/crm-types';

export default function LeadCustomFormsPage() {
  return (
    <HrEntityPage<WsLeadCustomForm & { _id: string }>
      title="Lead Custom Form Fields"
      subtitle="Define extra fields captured on every lead."
      icon={FormInput}
      singular="Field"
      getAllAction={getLeadCustomForms as any}
      saveAction={saveLeadCustomForm}
      deleteAction={deleteLeadCustomForm}
      columns={[
        { key: 'field_name', label: 'Field' },
        {
          key: 'field_type',
          label: 'Type',
          render: (row) => (
            <ClayBadge tone="blue">{row.field_type}</ClayBadge>
          ),
        },
        {
          key: 'field_values',
          label: 'Options',
          render: (row) =>
            Array.isArray(row.field_values) && row.field_values.length
              ? row.field_values.join(', ')
              : '—',
        },
        {
          key: 'is_required',
          label: 'Required',
          render: (row) => {
            const req =
              row.is_required === true ||
              (row.is_required as unknown as string) === 'true' ||
              (row.is_required as unknown as string) === 'yes';
            return (
              <ClayBadge tone={req ? 'rose' : 'neutral'}>
                {req ? 'Yes' : 'No'}
              </ClayBadge>
            );
          },
        },
      ]}
      fields={[
        { name: 'field_name', label: 'Field Name', required: true },
        {
          name: 'field_type',
          label: 'Field Type',
          type: 'select',
          required: true,
          options: [
            { value: 'text', label: 'Text' },
            { value: 'textarea', label: 'Textarea' },
            { value: 'select', label: 'Select' },
            { value: 'date', label: 'Date' },
            { value: 'number', label: 'Number' },
          ],
          defaultValue: 'text',
        },
        {
          name: 'field_values',
          label: 'Options (JSON array for select)',
          placeholder: '["Option A", "Option B"]',
          fullWidth: true,
          help: 'Only required when field type is "select".',
        },
        {
          name: 'is_required',
          label: 'Required',
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
