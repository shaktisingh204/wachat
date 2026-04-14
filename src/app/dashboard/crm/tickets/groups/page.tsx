'use client';

import { Users } from 'lucide-react';
import { HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getTicketGroups,
  saveTicketGroup,
  deleteTicketGroup,
} from '@/app/actions/worksuite/tickets-ext.actions';
import type { WsTicketGroup } from '@/lib/worksuite/tickets-ext-types';

export default function TicketGroupsPage() {
  return (
    <HrEntityPage<WsTicketGroup & { _id: string }>
      title="Ticket Groups"
      subtitle="Groups for categorising agents and tickets."
      icon={Users}
      singular="Group"
      getAllAction={getTicketGroups as any}
      saveAction={saveTicketGroup}
      deleteAction={deleteTicketGroup}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
      ]}
      fields={[
        { name: 'name', label: 'Group Name', required: true, fullWidth: true },
        { name: 'description', label: 'Description', type: 'textarea', fullWidth: true },
      ]}
    />
  );
}
