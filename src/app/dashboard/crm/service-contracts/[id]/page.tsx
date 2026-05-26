import { Badge, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';

/**
 * Service contract detail — `/dashboard/crm/service-contracts/[id]`.
 *
 * Per §1D.2: 9 actions, Overview · Coverage · Visit schedule · Billing ·
 * Notes · Attachments body, right rail w/ coverage status & related
 * tickets, audit footer.
 */

import Link from 'next/link';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getServiceContractById } from '@/app/actions/crm-service-contracts.actions';

import { ServiceContractDetailActions } from '../_components/service-contract-detail-actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface PageProps {
  params: Promise<{ id: string }>;
}

type ServiceContractDoc = {
  _id: string;
  contractNo?: string;
  title?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  asset?: string;
  assetName?: string;
  assets?: string[];
  coverage?: string;
  startDate?: string;
  endDate?: string;
  periodStart?: string;
  periodEnd?: string;
  frequency?: string;
  technician?: string;
  billing?: string;
  billingAmount?: number;
  currency?: string;
  status?: string;
  notes?: string;
  renewedAt?: string;
  visits?: Array<{
    _id?: string;
    date?: string;
    technician?: string;
    status?: string;
    notes?: string;
  }>;
};

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency ?? 'INR'} ${value}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function statusTone(status?: string): EntityStatusTone {
  switch (status) {
    case 'active':
      return 'green';
    case 'paused':
      return 'amber';
    case 'closed':
    case 'expired':
      return 'red';
    case 'draft':
    default:
      return 'neutral';
  }
}

function daysUntil(end?: string): number | null {
  if (!end) return null;
  const e = new Date(end);
  if (Number.isNaN(e.getTime())) return null;
  return Math.round((e.getTime() - Date.now()) / 86_400_000);
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
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

export default async function ServiceContractDetailPage({ params }: PageProps) {
  const { id } = await params;
  const contract = (await getServiceContractById(id)) as ServiceContractDoc | null;
  if (!contract) notFound();

  const title = contract.contractNo || contract.title || 'Service Contract';
  const status = contract.status ?? 'draft';
  const periodEnd = contract.periodEnd ?? contract.endDate ?? '';
  const remaining = daysUntil(periodEnd);
  const visits = contract.visits ?? [];

  return (
    <EntityDetailShell
      title={title}
      eyebrow="SERVICE CONTRACT"
      status={{ label: status, tone: statusTone(status) }}
      back={{
        href: '/dashboard/crm/service-contracts',
        label: 'All service contracts',
      }}
      actions={
        <ServiceContractDetailActions
          contractId={id}
          status={status}
          customerEmail={contract.customerEmail}
          periodEnd={periodEnd}
        />
      }
      audit={<EntityAuditTimeline entityKind="service_contract" entityId={id} />}
      rightRail={
        <>
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Coverage</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Status</span>
                  <Badge variant="outline">{status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Days remaining</span>
                  <span
                    className={`font-mono tabular-nums ${
                      remaining !== null && remaining < 0
                        ? 'text-zoru-danger-ink'
                        : 'text-zoru-ink'
                    }`}
                  >
                    {remaining === null
                      ? '—'
                      : remaining < 0
                      ? `${Math.abs(remaining)}d overdue`
                      : `${remaining}d`}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-zoru-line pt-2">
                  <span className="text-zoru-ink-muted">Billing</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(contract.billingAmount, contract.currency)}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Customer</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              {contract.customerId ? (
                <EntityPickerChip
                  entity="client"
                  id={contract.customerId}
                />
              ) : (
                <span className="text-[12.5px] text-zoru-ink-muted">
                  {contract.customerName || '—'}
                </span>
              )}
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Technician</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <span className="text-[12.5px] text-zoru-ink">
                {contract.technician || '—'}
              </span>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Related</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="flex flex-col gap-2 text-[12.5px]">
                <Link
                  href={`/dashboard/sabdesk?contractId=${id}`}
                  className="text-zoru-primary hover:underline"
                >
                  Tickets under this contract →
                </Link>
                <Link
                  href={`/dashboard/crm/sales/invoices?contractId=${id}`}
                  className="text-zoru-primary hover:underline"
                >
                  Linked invoices →
                </Link>
              </div>
            </ZoruCardContent>
          </Card>
        </>
      }
    >
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Overview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Contract number">{contract.contractNo || '—'}</Field>
            <Field label="Coverage">{contract.coverage || '—'}</Field>
            <Field label="Frequency">{contract.frequency || '—'}</Field>
            <Field label="Period start">
              {fmtDate(contract.periodStart ?? contract.startDate)}
            </Field>
            <Field label="Period end">{fmtDate(periodEnd)}</Field>
            <Field label="Billing amount">
              {fmtMoney(contract.billingAmount, contract.currency)}
            </Field>
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Coverage details</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer">
              {contract.customerId ? (
                <EntityPickerChip
                  entity="client"
                  id={contract.customerId}
                />
              ) : (
                contract.customerName || '—'
              )}
            </Field>
            <Field label="Asset(s)">
              {Array.isArray(contract.assets) && contract.assets.length > 0
                ? contract.assets.join(', ')
                : contract.assetName || contract.asset || '—'}
            </Field>
            <Field label="Technician">{contract.technician || '—'}</Field>
            <Field label="Billing model">{contract.billing || '—'}</Field>
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Visit schedule</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {visits.length === 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">
              No visits scheduled. Use{' '}
              <strong>Schedule visit</strong> in the header to add one.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line/60 text-left text-[11px] uppercase text-zoru-ink-muted">
                  <th className="py-2">Date</th>
                  <th className="py-2">Technician</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v, idx) => (
                  <tr
                    key={v._id ?? `${v.date}-${idx}`}
                    className="border-b border-zoru-line/40 last:border-0"
                  >
                    <td className="py-2">{fmtDate(v.date)}</td>
                    <td className="py-2">{v.technician || '—'}</td>
                    <td className="py-2">
                      <Badge variant="outline">
                        {v.status || 'scheduled'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Billing history</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {/* TODO 1D.2: billing-history child collection not yet implemented */}
          <p className="text-[13px] text-zoru-ink-muted">
            No billing entries yet.{' '}
            <Link
              href={`/dashboard/crm/sales/invoices?contractId=${id}`}
              className="text-zoru-primary hover:underline"
            >
              View linked invoices →
            </Link>
          </p>
        </ZoruCardContent>
      </Card>

      {contract.notes ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Notes</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
              {contract.notes}
            </p>
          </ZoruCardContent>
        </Card>
      ) : null}
    </EntityDetailShell>
  );
}
