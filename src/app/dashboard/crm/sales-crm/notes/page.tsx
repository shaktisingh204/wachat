'use client';

import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

import { StickyNote } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import {
  getLeadNotes,
  saveLeadNote,
  deleteLeadNote,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadNote } from '@/lib/worksuite/crm-types';

export default function LeadNotesPage() {
  return (
    <HrEntityPage<WsLeadNote & { _id: string }>
      title="Lead Notes"
      subtitle="Flat list of every note attached to a lead."
      icon={StickyNote}
      singular="Note"
      getAllAction={getLeadNotes as any}
      saveAction={saveLeadNote}
      deleteAction={deleteLeadNote}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'lead_id', label: 'Lead' },
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
          name: 'lead_id',
          label: 'Lead',
          required: true,
          type: 'entity',
          entity: 'lead',
          allowCreate: true,
          placeholder: 'Select or create a lead…',
          fullWidth: true,
        },
        { name: 'title', label: 'Title', required: true, fullWidth: true },
        { name: 'details', label: 'Details', type: 'textarea', fullWidth: true },
      ]}
    />
  );
}
