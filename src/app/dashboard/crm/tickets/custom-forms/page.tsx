'use client';

import { FormInput } from 'lucide-react';
import { HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getTicketCustomForms,
  saveTicketCustomForm,
  deleteTicketCustomForm,
} from '@/app/actions/worksuite/tickets-ext.actions';
import type { WsTicketCustomForm } from '@/lib/worksuite/tickets-ext-types';

export default function TicketCustomFormsPage() {
  return (
    <HrEntityPage<WsTicketCustomForm & { _id: string }>
      title="Ticket Custom Fields"
      subtitle="Additional form fields to collect on ticket creation."
      icon={FormInput}
      singular="Field"
      getAllAction={getTicketCustomForms as any}
      saveAction={saveTicketCustomForm}
      deleteAction={deleteTicketCustomForm}
      columns={[
        { key: 'field_name', label: 'Field' },
        { key: 'field_type', label: 'Type' },
        { key: 'field_values', label: 'Values' },
        {
          key: 'is_required',
          label: 'Required',
          render: (r) => (r.is_required ? 'Yes' : 'No'),
        },
      ]}
      fields={[
        { name: 'field_name', label: 'Field Name', required: true, fullWidth: true },
        {
          name: 'field_type',
          label: 'Field Type',
          type: 'select',
          required: true,
          options: [
            { value: 'text', label: 'Text' },
            { value: 'textarea', label: 'Textarea' },
            { value: 'select', label: 'Select' },
            { value: 'radio', label: 'Radio' },
            { value: 'checkbox', label: 'Checkbox' },
            { value: 'number', label: 'Number' },
            { value: 'date', label: 'Date' },
            { value: 'email', label: 'Email' },
            { value: 'url', label: 'URL' },
          ],
        },
        {
          name: 'field_values',
          label: 'Values (pipe-separated for select/radio/checkbox)',
          fullWidth: true,
          placeholder: 'option1|option2|option3',
        },
        {
          name: 'is_required',
          label: 'Required',
          type: 'select',
          options: [
            { value: 'false', label: 'No' },
            { value: 'true', label: 'Yes' },
          ],
        },
      ]}
    />
  );
}
