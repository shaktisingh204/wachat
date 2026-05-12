/**
 * Fixed asset detail — `/dashboard/crm/fixed-assets/[id]`.
 *
 * Server component: hydrates the asset via the Rust client, resolves
 * relational fields through `<EntityPickerChip>`, and renders the
 * standard depreciation/condition fields. Edit lives on this page; the
 * delete dialog is on the list page.
 *
 * No custom-field panel — `fixedAsset` is not a member of
 * `WsCustomFieldBelongsTo`.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, Pencil, ArrowLeft } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruBadge,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getFixedAsset } from '@/app/actions/crm/fixed-assets.actions';

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

function methodLabel(v?: string): string {
  switch (v) {
    case 'slm':
      return 'Straight-line (SLM)';
    case 'wdv':
      return 'Written-down value (WDV)';
    case 'units':
      return 'Units of production';
    default:
      return v || '—';
  }
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

export default async function FixedAssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { asset, error } = await getFixedAsset(id);

  if (!asset) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this fixed asset — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/fixed-assets">
              <ArrowLeft className="h-4 w-4" /> Back to Fixed Assets
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const displayName = asset.name || asset.code || 'Fixed asset';
  const subtitle = asset.code && asset.name ? asset.code : 'Fixed asset';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={displayName}
        subtitle={subtitle}
        icon={Boxes}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/fixed-assets">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/fixed-assets/${id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </ZoruButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <ZoruCard className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Header
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Asset code">{asset.code || '—'}</Field>
            <Field label="Asset name">{asset.name || '—'}</Field>
            <Field label="Category">{asset.category || '—'}</Field>
            <Field label="Condition">
              {asset.condition ? (
                <ZoruBadge variant="outline">{asset.condition}</ZoruBadge>
              ) : (
                '—'
              )}
            </Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Purchase
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Purchase date">{fmtDate(asset.purchaseDate)}</Field>
            <Field label="Purchase value">
              {fmtMoney(asset.cost, asset.currency)}
            </Field>
            <Field label="Currency">{asset.currency || '—'}</Field>
            <Field label="Vendor">
              {asset.supplierId ? (
                <EntityPickerChip entity="vendor" id={asset.supplierId} />
              ) : (
                '—'
              )}
            </Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Assignment
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Custodian">
              {asset.custodianEmployeeId ? (
                <EntityPickerChip entity="employee" id={asset.custodianEmployeeId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Location">{asset.location || '—'}</Field>
            <Field label="Warranty until">{fmtDate(asset.warrantyUntil)}</Field>
            <Field label="Insurance until">{fmtDate(asset.insuranceUntil)}</Field>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Depreciation
          </h3>
          <div className="flex flex-col gap-4">
            <Field label="Method">{methodLabel(asset.depreciationMethod)}</Field>
            <Field label="Useful life (months)">
              {asset.usefulLifeMonths ?? '—'}
            </Field>
            <Field label="Residual value">
              {fmtMoney(asset.residualValue, asset.currency)}
            </Field>
            <Field label="Accumulated depreciation">
              {fmtMoney(asset.accumulatedDepreciation, asset.currency)}
            </Field>
            <Field label="Net book value">
              {fmtMoney(asset.netBookValue, asset.currency)}
            </Field>
          </div>
        </ZoruCard>
      </div>

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(asset.createdAt || asset.audit?.createdAt)} · Updated{' '}
        {fmtDate(asset.updatedAt || asset.audit?.updatedAt)}
      </div>
    </div>
  );
}
