import { Button, Card, Badge } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import {
  Pencil,
  ArrowLeft,
  Handshake,
  ListChecks,
  LifeBuoy,
  FileText,
  } from 'lucide-react';

/**
 * Lead detail — `/dashboard/crm/leads/[id]`.
 *
 * Server component: hydrates the lead via the Rust client, resolves
 * relational fields through `<EntityPickerChip>`, and renders the
 * custom-field bag alongside the standard fields. Edit and Delete
 * actions live on this page; the delete dialog is on the list page.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { PinButton } from '@/components/crm/pin-button';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import { RelatedRail } from '@/components/crm/RelatedRail';
import { getLead } from '@/app/actions/crm/leads.actions';
import { getCrmLeadRelatedCounts } from '@/app/actions/crm-leads.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
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

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ lead, error }, customFields, relatedCounts] = await Promise.all([
    getLead(id),
    getCustomFieldsFor('lead') as Promise<WsCustomField[]>,
    getCrmLeadRelatedCounts(id),
  ]);

  if (!lead) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">Couldn&apos;t load this lead — {error}</p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm/leads">
              <ArrowLeft className="h-4 w-4" /> Back to Leads
            </Link>
          </Button>
        </div>
      );
    }
    notFound();
  }

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || 'Lead';
  const cfValues = (lead.customFields ?? {}) as Record<string, unknown>;

  return (
    <EntityDetailShell
      eyebrow="LEAD"
      title={fullName}
      back={{ href: '/dashboard/crm/leads', label: 'Leads' }}
      actions={
        <div className="flex items-center gap-2">
          <PinButton entityType="lead" entityId={id} title={fullName} />
          <Button asChild>
            <Link href={`/dashboard/crm/leads/${id}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
        </div>
      }
    >

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Identity & Contact
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name">{fullName}</Field>
            <Field label="Email">{lead.email || '—'}</Field>
            <Field label="Phone">{lead.phone || '—'}</Field>
            <Field label="Company">{lead.company || '—'}</Field>
            <Field label="Job title">{lead.title || '—'}</Field>
            <Field label="Industry">{lead.industry || '—'}</Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Workflow
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Source">{lead.attribution?.source || '—'}</Field>
            <Field label="Sub-source">{lead.subSource || '—'}</Field>
            <Field label="Status">
              {lead.status?.name ? <Badge variant="outline">{lead.status.name}</Badge> : '—'}
            </Field>
            <Field label="Lead score">{lead.leadScore ?? '—'}</Field>
            <Field label="Owner">
              {lead.ownerId ? (
                <EntityPickerChip entity="user" id={lead.ownerId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Assigned to">
              {lead.assignment?.assignedTo ? (
                <EntityPickerChip entity="user" id={lead.assignment.assignedTo} />
              ) : (
                '—'
              )}
            </Field>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Value & Forecast
            </h3>
            <div className="flex flex-col gap-4">
              <Field label="Estimated value">{fmtMoney(lead.estimatedValue, lead.currency)}</Field>
              <Field label="Currency">{lead.currency || '—'}</Field>
              <Field label="Probability">
                {typeof lead.probabilityPct === 'number' ? `${lead.probabilityPct}%` : '—'}
              </Field>
              <Field label="Expected close">{fmtDate(lead.expectedClose)}</Field>
            </div>
          </Card>

          <RelatedRail
            items={[
              {
                label: 'Deals',
                count: relatedCounts.deals,
                icon: <Handshake className="h-3.5 w-3.5" />,
                href: `/dashboard/crm/sales-crm/deals?leadId=${id}`,
              },
              {
                label: 'Tasks',
                count: relatedCounts.tasks,
                icon: <ListChecks className="h-3.5 w-3.5" />,
                href: `/dashboard/crm/tasks?leadId=${id}`,
              },
              {
                label: 'Tickets',
                count: relatedCounts.tickets,
                icon: <LifeBuoy className="h-3.5 w-3.5" />,
                href: `/dashboard/crm/tickets?leadId=${id}`,
              },
              {
                label: 'Quotations',
                count: relatedCounts.quotations,
                icon: <FileText className="h-3.5 w-3.5" />,
                href: `/dashboard/crm/sales/quotations?leadId=${id}`,
              },
            ]}
          />
        </div>
      </div>

      {customFields.length > 0 ? (
        <Card className="p-6">
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
        </Card>
      ) : null}

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(lead.createdAt || lead.audit?.createdAt)} · Updated{' '}
        {fmtDate(lead.updatedAt || lead.audit?.updatedAt)}
      </div>
    </EntityDetailShell>
  );
}
