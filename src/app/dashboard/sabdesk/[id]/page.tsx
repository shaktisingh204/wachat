import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from "@/components/sabcrm/20ui/zoru";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare, Paperclip, Ticket } from "lucide-react";

/**
 * Ticket detail — `/dashboard/sabdesk/[id]` (§1D.2 bar).
 *
 * Server component: hydrates the ticket via the Rust client, then hands
 * off interactive bits (status pill dropdown, action group, SLA badge,
 * conversation composer, merge dialog) to `<TicketDetailClient>`.
 *
 * Layout: two-column (main + right rail). Right rail surfaces linked
 * entities — requester, agent group, deal/invoice, parent ticket —
 * each as an `<EntityPickerChip>`.
 */

import Link from "next/link";

import { EntityDetailShell } from "@/components/crm/entity-detail-shell";
import { EntityPickerChip } from "@/components/crm/entity-picker";
import { CustomFieldDisplay } from "@/components/crm/custom-field-input";
import { RelatedRail } from "@/components/crm/RelatedRail";
import { AssignmentControl } from "@/components/crm/assignment-control";
import {
  getTicket,
  getCrmTicketRelatedCounts,
} from "@/app/actions/crm/tickets.actions";
import { getCustomFieldsFor } from "@/app/actions/worksuite/meta.actions";
import type { WsCustomField } from "@/lib/worksuite/meta-types";

import { TicketDetailClient } from "../_components/ticket-detail-client";
import { Suspense } from "react";
import { TicketConversationThread } from "../_components/ticket-conversation-thread";

export const dynamic = "force-dynamic";

const PRIORITY_VARIANTS: Record<
  string,
  React.ComponentProps<typeof ZoruBadge>["variant"]
> = {
  low: "ghost",
  medium: "success",
  high: "warning",
  critical: "danger",
};

function fmtDate(v?: string): string {
  if (!v) return "—";
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function fmtDateTime(v?: string): string {
  if (!v) return "—";
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes} UTC`;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
    </div>
  );
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ ticket, error }, customFields, relatedCounts] = await Promise.all([
    getTicket(id),
    getCustomFieldsFor("ticket") as Promise<WsCustomField[]>,
    getCrmTicketRelatedCounts(id),
  ]);

  if (!ticket) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-[var(--st-text)]">
            Couldn&apos;t load this ticket — {error}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/sabdesk">
              <ArrowLeft className="h-4 w-4" /> Back to Tickets
            </Link>
          </Button>
        </div>
      );
    }
    notFound();
  }

  const subject = ticket.subject || "Ticket";
  const priority = String(ticket.priority ?? "").toLowerCase();
  const cfBag = (ticket.customFields ?? {}) as Record<string, unknown>;
  const requesterKind =
    String(cfBag.requesterKind ?? "").toLowerCase() === "lead"
      ? "lead"
      : String(cfBag.requesterKind ?? "").toLowerCase() === "employee"
        ? "employee"
        : "client";
  const tags: string[] = Array.isArray(cfBag.tags)
    ? (cfBag.tags as unknown[]).map((x) => String(x))
    : [];
  const description = (cfBag.description as string | undefined) ?? "";

  return (
    <EntityDetailShell
      eyebrow="TICKET"
      title={subject}
      back={{ href: "/dashboard/sabdesk", label: "Tickets" }}
    >
      <TicketDetailClient ticket={ticket}>
        <Suspense
          fallback={
            <div className="p-3 text-center text-[var(--st-text-secondary)]">
              Loading conversation thread...
            </div>
          }
        >
          <TicketConversationThread ticketId={id} />
        </Suspense>
      </TicketDetailClient>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="p-6">
            <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Basics
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Subject">{subject}</Field>
              <Field label="Requester">
                {ticket.requesterId ? (
                  <EntityPickerChip
                    entity={requesterKind}
                    id={ticket.requesterId}
                  />
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Channel">
                {ticket.channel ? (
                  <Badge variant="secondary">{ticket.channel}</Badge>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Category">
                {ticket.category ? (
                  <EntityPickerChip entity="category" id={ticket.category} />
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Severity">
                <span className="uppercase">{ticket.severity ?? "—"}</span>
              </Field>
              <Field label="Priority">
                {priority ? (
                  <Badge variant={PRIORITY_VARIANTS[priority] ?? "ghost"}>
                    {priority}
                  </Badge>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Due by">{fmtDateTime(ticket.dueBy)}</Field>
              <Field label="Satisfaction (CSAT)">
                {typeof ticket.satisfactionRating === "number"
                  ? `${ticket.satisfactionRating} / 5`
                  : "—"}
              </Field>
              {description ? (
                <div className="md:col-span-2">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Description
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                    {description}
                  </p>
                </div>
              ) : null}
            </div>
          </Card>

          {customFields.length > 0 ? (
            <Card className="p-6">
              <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Custom fields
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {customFields.map((f) => (
                  <Field
                    key={String(f._id ?? f.name)}
                    label={f.label || f.name}
                  >
                    <CustomFieldDisplay
                      field={f}
                      value={
                        cfBag[f.name] as Parameters<
                          typeof CustomFieldDisplay
                        >[0]["value"]
                      }
                    />
                  </Field>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Assignment</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-3">
              <AssignmentControl
                entityType="ticket"
                entityId={id}
                currentAssigneeId={ticket.assigneeId ?? null}
                label="Agent"
              />
              <Field label="Assignee (legacy)">
                {ticket.assigneeId ? (
                  <EntityPickerChip entity="user" id={ticket.assigneeId} />
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Agent group">
                {cfBag.agentGroupId ? (
                  <EntityPickerChip
                    entity="ticketGroup"
                    id={String(cfBag.agentGroupId)}
                  />
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Assigned by">
                {ticket.assignment?.assignedBy ? (
                  <EntityPickerChip
                    entity="user"
                    id={ticket.assignment.assignedBy}
                  />
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Assigned at">
                {fmtDateTime(ticket.assignment?.assignedAt)}
              </Field>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Linked</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-3">
              <Field label="Deal">
                {ticket.linkedDealId ? (
                  <EntityPickerChip entity="deal" id={ticket.linkedDealId} />
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Invoice">
                {ticket.linkedInvoiceId ? (
                  <EntityPickerChip
                    entity="invoice"
                    id={ticket.linkedInvoiceId}
                  />
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Parent ticket">
                {ticket.parentTicketId ? (
                  <Link
                    href={`/dashboard/sabdesk/${ticket.parentTicketId}`}
                    className="text-[13px] text-[var(--st-text)] hover:underline"
                  >
                    #{ticket.parentTicketId.slice(-6).toUpperCase()}
                  </Link>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Product">
                {ticket.productId ? (
                  <EntityPickerChip entity="item" id={ticket.productId} />
                ) : (
                  "—"
                )}
              </Field>
            </ZoruCardContent>
          </Card>

          {tags.length > 0 ? (
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Tags</ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent className="flex flex-wrap gap-1.5">
                {tags.map((tId) => (
                  <EntityPickerChip key={tId} entity="tag" id={tId} />
                ))}
              </ZoruCardContent>
            </Card>
          ) : null}

          <RelatedRail
            items={[
              {
                label: "Replies",
                count: relatedCounts.replies,
                icon: <MessageSquare className="h-3.5 w-3.5" />,
                href: `/dashboard/sabdesk/${id}/activity`,
              },
              {
                label: "Attachments",
                count: relatedCounts.attachments,
                icon: <Paperclip className="h-3.5 w-3.5" />,
                href: `/dashboard/sabdesk/${id}`,
              },
              {
                label: "Related tickets",
                count: relatedCounts.relatedTickets,
                icon: <Ticket className="h-3.5 w-3.5" />,
                href: `/dashboard/sabdesk?relatedTo=${id}`,
              },
            ]}
          />
        </aside>
      </div>

      <div className="text-[11px] text-[var(--st-text-secondary)]">
        Created {fmtDate(ticket.createdAt || ticket.audit?.createdAt)} · Updated{" "}
        {fmtDate(ticket.updatedAt || ticket.audit?.updatedAt)}
      </div>
    </EntityDetailShell>
  );
}
