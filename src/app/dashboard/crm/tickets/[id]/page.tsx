/**
 * Ticket detail — `/dashboard/crm/tickets/[id]`.
 *
 * Server component: hydrates the ticket via the Rust client, resolves
 * relational fields through `<EntityPickerChip>`, and renders the
 * custom-field bag alongside the standard fields. Edit and Back
 * actions live on this page; the delete dialog is on the list page.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LifeBuoy, Pencil, ArrowLeft } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruBadge,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import { getTicket } from '@/app/actions/crm/tickets.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

type BadgeVariant = React.ComponentProps<typeof ZoruBadge>['variant'];

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  open: 'warning',
  pending: 'ghost',
  on_hold: 'ghost',
  resolved: 'success',
  closed: 'ghost',
  reopened: 'warning',
};

const PRIORITY_VARIANTS: Record<string, BadgeVariant> = {
  low: 'ghost',
  medium: 'success',
  high: 'warning',
  critical: 'danger',
};

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtDateTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function statusLabel(s?: string): string {
  if (!s) return '—';
  return s.replace(/_/g, ' ');
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ ticket, error }, customFields] = await Promise.all([
    getTicket(id),
    getCustomFieldsFor('ticket') as Promise<WsCustomField[]>,
  ]);

  if (!ticket) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">Couldn&apos;t load this ticket — {error}</p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/tickets">
              <ArrowLeft className="h-4 w-4" /> Back to Tickets
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const subject = ticket.subject || 'Ticket';
  const status = ticket.status ?? '';
  const priority = ticket.priority ?? '';
  const statusVariant = STATUS_VARIANTS[status] ?? 'ghost';
  const priorityVariant = PRIORITY_VARIANTS[priority] ?? 'ghost';
  const cfValues = (ticket.customFields ?? {}) as Record<string, unknown>;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={subject}
        subtitle={ticket.category ? `Category: ${ticket.category}` : 'Ticket'}
        icon={LifeBuoy}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/tickets">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/tickets/${id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </ZoruButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <ZoruCard className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Basics
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Subject">{subject}</Field>
            <Field label="Client (requester)">
              {ticket.requesterId ? (
                <EntityPickerChip entity="client" id={ticket.requesterId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Category">
              {ticket.category ? (
                <EntityPickerChip entity="category" id={ticket.category} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Channel">{ticket.channel ?? '—'}</Field>
            <Field label="Severity">
              <span className="uppercase">{ticket.severity ?? '—'}</span>
            </Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Workflow
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Status">
              {status ? (
                <ZoruBadge variant={statusVariant}>{statusLabel(status)}</ZoruBadge>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Priority">
              {priority ? (
                <ZoruBadge variant={priorityVariant}>{priority}</ZoruBadge>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Due by">{fmtDateTime(ticket.dueBy)}</Field>
            <Field label="Satisfaction (CSAT)">
              {typeof ticket.satisfactionRating === 'number'
                ? `${ticket.satisfactionRating} / 5`
                : '—'}
            </Field>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Assignment
          </h3>
          <div className="flex flex-col gap-4">
            <Field label="Assignee">
              {ticket.assigneeId ? (
                <EntityPickerChip entity="user" id={ticket.assigneeId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Assigned by">
              {ticket.assignment?.assignedBy ? (
                <EntityPickerChip entity="user" id={ticket.assignment.assignedBy} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Assigned at">{fmtDateTime(ticket.assignment?.assignedAt)}</Field>
          </div>
        </ZoruCard>
      </div>

      {customFields.length > 0 ? (
        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Custom fields
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {customFields.map((f) => (
              <Field key={String(f._id ?? f.name)} label={f.label || f.name}>
                <CustomFieldDisplay
                  field={f}
                  value={cfValues[f.name] as Parameters<typeof CustomFieldDisplay>[0]['value']}
                />
              </Field>
            ))}
          </div>
        </ZoruCard>
      ) : null}

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(ticket.createdAt || ticket.audit?.createdAt)} · Updated{' '}
        {fmtDate(ticket.updatedAt || ticket.audit?.updatedAt)}
      </div>
    </div>
  );
}
