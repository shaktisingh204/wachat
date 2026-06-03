/**
 * Edit ticket — `/dashboard/sabdesk/[id]/edit`.
 *
 * Hydrates the existing ticket, fetches custom-field definitions, and
 * passes both to the shared `<TicketForm>` (re-used from the Create
 * flow). The form submits a PATCH because `_id` is rendered as a
 * hidden input.
 */

import { notFound } from "next/navigation";

import { EntityDetailShell } from "@/components/crm/entity-detail-shell";
import { TicketForm } from "../../_components/ticket-form";
import { getTicket } from "@/app/actions/crm/tickets.actions";
import { getCustomFieldsFor } from "@/app/actions/worksuite/meta.actions";
import type { WsCustomField } from "@/lib/worksuite/meta-types";

export const dynamic = "force-dynamic";

export default async function EditTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ ticket }, customFields] = await Promise.all([
    getTicket(id),
    getCustomFieldsFor("ticket") as Promise<WsCustomField[]>,
  ]);

  if (!ticket) notFound();

  const subject = ticket.subject || "Ticket";

  return (
    <EntityDetailShell
      eyebrow="TICKET"
      title={`Edit ${subject}`}
      back={{ href: `/dashboard/sabdesk/${id}`, label: "Back to ticket" }}
    >
      <TicketForm initial={ticket} customFields={customFields} />
    </EntityDetailShell>
  );
}
