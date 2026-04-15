'use client';

import { UsersRound } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import {
  getTicketAgentGroups,
  saveTicketAgentGroup,
  deleteTicketAgentGroup,
} from '@/app/actions/worksuite/tickets-ext.actions';
import type { WsTicketAgentGroup } from '@/lib/worksuite/tickets-ext-types';

export default function TicketAgentGroupsPage() {
  return (
    <HrEntityPage<WsTicketAgentGroup & { _id: string }>
      title="Agent Groups"
      subtitle="Map support agents to ticket groups."
      icon={UsersRound}
      singular="Mapping"
      getAllAction={getTicketAgentGroups as any}
      saveAction={saveTicketAgentGroup}
      deleteAction={deleteTicketAgentGroup}
      columns={[
        { key: 'agent_user_id', label: 'Agent' },
        { key: 'group_id', label: 'Group' },
      ]}
      fields={[
        { name: 'agent_user_id', label: 'Agent User ID', required: true },
        { name: 'group_id', label: 'Group ID', required: true },
      ]}
    />
  );
}
