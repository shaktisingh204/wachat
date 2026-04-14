'use client';

import { MessageSquareText } from 'lucide-react';
import { HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getTicketReplyTemplates,
  saveTicketReplyTemplate,
  deleteTicketReplyTemplate,
} from '@/app/actions/worksuite/tickets-ext.actions';
import type { WsTicketReplyTemplate } from '@/lib/worksuite/tickets-ext-types';

export default function TicketReplyTemplatesPage() {
  return (
    <HrEntityPage<WsTicketReplyTemplate & { _id: string }>
      title="Ticket Reply Templates"
      subtitle="Canned responses that agents can paste into replies."
      icon={MessageSquareText}
      singular="Template"
      getAllAction={getTicketReplyTemplates as any}
      saveAction={saveTicketReplyTemplate}
      deleteAction={deleteTicketReplyTemplate}
      columns={[
        { key: 'heading', label: 'Heading' },
        {
          key: 'body',
          label: 'Preview',
          render: (r) => (r.body || '').slice(0, 80),
        },
      ]}
      fields={[
        { name: 'heading', label: 'Heading', required: true, fullWidth: true },
        { name: 'body', label: 'Body', type: 'textarea', required: true, fullWidth: true },
      ]}
    />
  );
}
