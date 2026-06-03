"use client";

/**
 * Ticket Tags — settings-list with light Deep treatment.
 *
 * KPI · search/status filter · bulk delete · CSV/XLSX export ·
 * RowDrawer inline summary · inline-edit dialog · PaginationBar.
 *
 * Backed by the worksuite `crm_ticket_tags` collection through
 * `worksuite/tickets-ext.actions.ts`.
 */

import * as React from "react";

import {
  SettingsDeepPage,
  type SettingsColumn,
} from "../../crm/_components/settings-deep-page";
import {
  bulkDeleteTicketTags,
  deleteTicketTag,
  getTicketTagKpis,
  getTicketTags,
  saveTicketTag,
} from "@/app/actions/worksuite/tickets-ext.actions";
import type { WsTicketTag } from "@/lib/worksuite/tickets-ext-types";

type Row = Omit<WsTicketTag, "_id" | "userId" | "createdAt" | "updatedAt"> & {
  _id: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
};

const columns: SettingsColumn<Row>[] = [
  {
    key: "tag_name",
    label: "Tag",
    exportValue: (r) => r.tag_name,
  },
];

export default function TicketTagsPage(): React.JSX.Element {
  return (
    <SettingsDeepPage<Row>
      title="Ticket Tags"
      subtitle="Free-form labels that can be attached to tickets."
      singular="Tag"
      drawerKind="Ticket Tag"
      exportBaseName="ticket-tags"
      columns={columns}
      fields={[
        {
          name: "tag_name",
          label: "Tag name",
          required: true,
          fullWidth: true,
          placeholder: "e.g. urgent",
        },
      ]}
      getAllAction={getTicketTags as unknown as () => Promise<Row[]>}
      getKpisAction={getTicketTagKpis}
      saveAction={saveTicketTag}
      deleteAction={deleteTicketTag}
      bulkDeleteAction={bulkDeleteTicketTags}
      displayName={(r) => r.tag_name ?? "—"}
      searchText={(r) => `${r.tag_name ?? ""}`}
    />
  );
}
