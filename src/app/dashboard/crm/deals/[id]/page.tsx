import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Trophy, Pencil, ArrowLeft } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruBadge,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import { getDeal } from '@/app/actions/crm/deals.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'outline'> = {
  open: 'outline',
  won: 'success',
  lost: 'danger',
  abandoned: 'warning',
};

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

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ deal, error }, customFields] = await Promise.all([
    getDeal(id),
    getCustomFieldsFor('deal') as Promise<WsCustomField[]>,
  ]);

  if (!deal) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">Couldn&apos;t load this deal — {error}</p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/deals">
              <ArrowLeft className="h-4 w-4" /> Back to Deals
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const partyEntity = deal.party?.kind === 'lead' ? 'lead' : 'client';
  const cfValues = (deal.customFields ?? {}) as Record<string, unknown>;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={deal.title}
        subtitle={fmtMoney(deal.amount, deal.currency)}
        icon={Trophy}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/deals">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/deals/${id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </ZoruButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <ZoruCard className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Pipeline & Ownership
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Status">
              {deal.status ? (
                <ZoruBadge variant={STATUS_VARIANTS[deal.status] ?? 'outline'}>{deal.status}</ZoruBadge>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Owner">
              {deal.ownerId ? <EntityPickerChip entity="user" id={deal.ownerId} /> : '—'}
            </Field>
            <Field label="Pipeline">
              {deal.pipelineId ? (
                <EntityPickerChip entity="pipeline" id={deal.pipelineId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Stage">
              {deal.stageId ? <EntityPickerChip entity="stage" id={deal.stageId} /> : '—'}
            </Field>
            <Field label={partyEntity === 'lead' ? 'Lead' : 'Client'}>
              {deal.party?.id ? (
                <EntityPickerChip entity={partyEntity} id={deal.party.id} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Won / Lost reason">{deal.wonLostReason || '—'}</Field>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Value & Forecast
          </h3>
          <div className="flex flex-col gap-4">
            <Field label="Amount">{fmtMoney(deal.amount, deal.currency)}</Field>
            <Field label="Probability">
              {typeof deal.probabilityPct === 'number' ? `${deal.probabilityPct}%` : '—'}
            </Field>
            <Field label="Expected close">{fmtDate(deal.expectedClose)}</Field>
            <Field label="Actual close">{fmtDate(deal.actualClose)}</Field>
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
        Created {fmtDate(deal.createdAt || deal.audit?.createdAt)} · Updated{' '}
        {fmtDate(deal.updatedAt || deal.audit?.updatedAt)}
      </div>
    </div>
  );
}
