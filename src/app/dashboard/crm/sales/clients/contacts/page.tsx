'use client';

import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

import { Contact } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../../_components/hr-entity-page';
import {
  getClientContacts,
  saveClientContact,
  deleteClientContact,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { WsClientContact } from '@/lib/worksuite/crm-types';

export default function ClientContactsPage() {
  return (
    <HrEntityPage<WsClientContact & { _id: string }>
      title="Client Contacts"
      subtitle="All people associated with your client accounts."
      icon={Contact}
      singular="Contact"
      getAllAction={getClientContacts as any}
      saveAction={saveClientContact}
      deleteAction={deleteClientContact}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'job_title', label: 'Job Title' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'client_id', label: 'Client' },
        {
          key: 'is_primary',
          label: 'Primary',
          render: (row) => {
            const p =
              row.is_primary === true ||
              (row.is_primary as unknown as string) === 'true' ||
              (row.is_primary as unknown as string) === 'yes';
            return (
              <ClayBadge tone={p ? 'amber' : 'neutral'}>
                {p ? 'Yes' : 'No'}
              </ClayBadge>
            );
          },
        },
      ]}
      fields={[
        {
          name: 'client_id',
          label: 'Client',
          required: true,
          type: 'entity',
          entity: 'client',
          allowCreate: true,
          placeholder: 'Select or create a client…',
          fullWidth: true,
        },
        { name: 'name', label: 'Name', required: true },
        { name: 'job_title', label: 'Job Title' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone' },
        {
          name: 'is_primary',
          label: 'Primary Contact',
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
