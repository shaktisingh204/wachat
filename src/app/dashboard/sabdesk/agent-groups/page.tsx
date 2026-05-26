'use client';

/**
 * Ticket Agent Groups — settings-list mapping agents to support groups.
 *
 * KPI · search/status filter · bulk delete · CSV/XLSX export ·
 * RowDrawer inline summary · inline-edit dialog · PaginationBar.
 *
 * Backed by the worksuite `crm_ticket_agent_groups` collection through
 * `worksuite/tickets-ext.actions.ts`.
 */

import * as React from 'react';

import {
  SettingsDeepPage,
  type SettingsColumn,
} from '../../crm/_components/settings-deep-page';
import {
  bulkDeleteTicketAgentGroups,
  deleteTicketAgentGroup,
  getTicketAgentGroupKpis,
  getTicketAgentGroups,
  saveTicketAgentGroup,
} from '@/app/actions/worksuite/tickets-ext.actions';
import type { WsTicketAgentGroup } from '@/lib/worksuite/tickets-ext-types';

type Row = Omit<WsTicketAgentGroup, '_id' | 'userId' | 'createdAt' | 'updatedAt'> & {
  _id: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
};

const columns: SettingsColumn<Row>[] = [
  {
    key: 'agent_user_id',
    label: 'Agent',
    exportValue: (r) => r.agent_user_id,
  },
  {
    key: 'group_id',
    label: 'Group',
    exportValue: (r) => r.group_id,
  },
];

export default function TicketAgentGroupsPage(): React.JSX.Element {
  return (
    <SettingsDeepPage<Row>
      title="Agent Groups"
      subtitle="Map support agents to ticket groups for routing."
      singular="Mapping"
      drawerKind="Agent Group Mapping"
      exportBaseName="ticket-agent-groups"
      columns={columns}
      fields={[
        {
          name: 'agent_user_id',
          label: 'Agent (user id)',
          required: true,
          placeholder: 'User id',
        },
        {
          name: 'group_id',
          label: 'Group id',
          required: true,
          placeholder: 'Ticket group id',
        },
      ]}
      getAllAction={getTicketAgentGroups as unknown as () => Promise<Row[]>}
      getKpisAction={getTicketAgentGroupKpis}
      saveAction={saveTicketAgentGroup}
      deleteAction={deleteTicketAgentGroup}
      bulkDeleteAction={bulkDeleteTicketAgentGroups}
      displayName={(r) =>
        `${r.agent_user_id ?? '—'} → ${r.group_id ?? '—'}`
      }
      searchText={(r) => `${r.agent_user_id ?? ''} ${r.group_id ?? ''}`}
    />
  );
}
