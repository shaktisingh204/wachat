'use client';

import { StickyNote } from 'lucide-react';
import { HrEntityPage } from '../../../_components/hr-entity-page';
import {
  getClientNotes,
  saveClientNote,
  deleteClientNote,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { WsClientNote } from '@/lib/worksuite/crm-types';

export default function ClientNotesPage() {
  return (
    <HrEntityPage<WsClientNote & { _id: string }>
      title="Client Notes"
      subtitle="Flat list of every note attached to a client account."
      icon={StickyNote}
      singular="Note"
      getAllAction={getClientNotes as any}
      saveAction={saveClientNote}
      deleteAction={deleteClientNote}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'client_id', label: 'Client' },
        {
          key: 'details',
          label: 'Details',
          render: (row) => {
            const t = (row.details || '').slice(0, 80);
            return t.length < (row.details || '').length ? `${t}…` : t || '—';
          },
        },
      ]}
      fields={[
        {
          name: 'client_id',
          label: 'Client ID',
          required: true,
          placeholder: 'Mongo ObjectId of the account',
          fullWidth: true,
        },
        { name: 'title', label: 'Title', required: true, fullWidth: true },
        { name: 'details', label: 'Details', type: 'textarea', fullWidth: true },
      ]}
    />
  );
}
