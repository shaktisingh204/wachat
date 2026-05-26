'use client';

/**
 * Ticket Channels — settings-list with light Deep treatment.
 *
 * KPI · search/status filter · bulk delete · CSV/XLSX export ·
 * RowDrawer inline summary · inline-edit dialog · PaginationBar.
 *
 * Backed by the worksuite `crm_ticket_channels` collection through
 * `worksuite/tickets-ext.actions.ts`.
 */

import * as React from 'react';

import {
  SettingsDeepPage,
  type SettingsColumn,
} from '../../crm/_components/settings-deep-page';
import {
  bulkDeleteTicketChannels,
  deleteTicketChannel,
  getTicketChannelKpis,
  getTicketChannels,
  saveTicketChannel,
} from '@/app/actions/worksuite/tickets-ext.actions';
import type { WsTicketChannel } from '@/lib/worksuite/tickets-ext-types';

type Row = Omit<WsTicketChannel, '_id' | 'userId' | 'createdAt' | 'updatedAt'> & {
  _id: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
};

const columns: SettingsColumn<Row>[] = [
  {
    key: 'name',
    label: 'Name',
    exportValue: (r) => r.name,
  },
];

export default function TicketChannelsPage(): React.JSX.Element {
  return (
    <SettingsDeepPage<Row>
      title="Ticket Channels"
      subtitle="Inbound channels where tickets can originate (email, web, chat…)."
      singular="Channel"
      drawerKind="Ticket Channel"
      exportBaseName="ticket-channels"
      columns={columns}
      fields={[
        {
          name: 'name',
          label: 'Channel name',
          required: true,
          fullWidth: true,
          placeholder: 'e.g. Email inbox',
        },
      ]}
      getAllAction={getTicketChannels as unknown as () => Promise<Row[]>}
      getKpisAction={getTicketChannelKpis}
      saveAction={saveTicketChannel}
      deleteAction={deleteTicketChannel}
      bulkDeleteAction={bulkDeleteTicketChannels}
      displayName={(r) => r.name ?? '—'}
      searchText={(r) => `${r.name ?? ''}`}
    />
  );
}
