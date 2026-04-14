'use client';

import { Radio } from 'lucide-react';
import { HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getTicketChannels,
  saveTicketChannel,
  deleteTicketChannel,
} from '@/app/actions/worksuite/tickets-ext.actions';
import type { WsTicketChannel } from '@/lib/worksuite/tickets-ext-types';

export default function TicketChannelsPage() {
  return (
    <HrEntityPage<WsTicketChannel & { _id: string }>
      title="Ticket Channels"
      subtitle="Inbound channels where tickets can originate."
      icon={Radio}
      singular="Channel"
      getAllAction={getTicketChannels as any}
      saveAction={saveTicketChannel}
      deleteAction={deleteTicketChannel}
      columns={[{ key: 'name', label: 'Name' }]}
      fields={[
        { name: 'name', label: 'Channel Name', required: true, fullWidth: true },
      ]}
    />
  );
}
