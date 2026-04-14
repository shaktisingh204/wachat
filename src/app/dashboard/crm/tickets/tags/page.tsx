'use client';

import { Hash } from 'lucide-react';
import { HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getTicketTags,
  saveTicketTag,
  deleteTicketTag,
} from '@/app/actions/worksuite/tickets-ext.actions';
import type { WsTicketTag } from '@/lib/worksuite/tickets-ext-types';

export default function TicketTagsPage() {
  return (
    <HrEntityPage<WsTicketTag & { _id: string }>
      title="Ticket Tags"
      subtitle="Free-form labels that can be attached to tickets."
      icon={Hash}
      singular="Tag"
      getAllAction={getTicketTags as any}
      saveAction={saveTicketTag}
      deleteAction={deleteTicketTag}
      columns={[{ key: 'tag_name', label: 'Tag' }]}
      fields={[
        { name: 'tag_name', label: 'Tag Name', required: true, fullWidth: true },
      ]}
    />
  );
}
