import { Badge, Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * Fixed-asset detail — `/dashboard/crm/fixed-assets/[id]`.
 *
 * Server component per §1D.2. Composes `<EntityDetailShell>` with:
 *   - Header: 9 actions (Edit · Assign · Unassign · Depreciate now ·
 *     Retire · Print label · Maintenance log · Archive · Activity).
 *   - Body cards: Overview · Cost & depreciation · Custodian history ·
 *     Maintenance log · Insurance/Warranty · Documents.
 *   - Right rail: NBV card · Cost · Depreciation YTD · Custodian chip ·
 *     Location chip · Related entities (asset assignments).
 *   - Audit footer via `audit` prop.
 */

import Link from 'next/link';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getFixedAsset } from '@/app/actions/crm/fixed-assets.actions';

import { FixedAssetDetailActions } from '../_components/fixed-asset-detail-actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { MaintenanceLogCard } from './maintenance-log-card';
import { QrCodeCard } from './qr-code-card';
import { DepreciationScheduleCard } from './depreciation-schedule-card';
import { CustodyHistoryCard } from './custody-history-card';

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
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
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

function conditionTone(condition?: string): EntityStatusTone {
  switch (condition) {
    case 'new':
    case 'good':
      return 'green';
    case 'fair':
      return 'amber';
    case 'damaged':
    case 'retired':
      return 'red';
    default:
      return 'neutral';
  }
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
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm/fixed-assets">
              <ArrowLeft className="h-4 w-4" /> Back to Fixed Assets
            </Link>
          </Button>
        </div>
      );
    }
    notFound();
  }

  const title = asset.name || asset.code || 'Fixed asset';
  const condition = asset.condition ?? 'good';

  return (
    <EntityDetailShell
      title={title}
      eyebrow={`FIXED ASSET · ${asset.code ?? ''}`}
      status={{ label: condition, tone: conditionTone(condition) }}
      back={{
        href: '/dashboard/crm/fixed-assets',
        label: 'Back to Fixed Assets',
      }}
      actions={
        <FixedAssetDetailActions
          assetId={id}
          custodianEmployeeId={asset.custodianEmployeeId}
        />
      }
      audit={<EntityAuditTimeline entityKind="fixed_asset" entityId={id} />}
      rightRail={
        <>
          <QrCodeCard value={String(asset._id)} code={asset.code || String(asset._id)} />
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Net book value</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">NBV</span>
                  <span className="font-mono tabular-nums text-zoru-ink">
                    {fmtMoney(asset.netBookValue, asset.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Cost</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(asset.cost, asset.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-zoru-line pt-2">
                  <span className="text-zoru-ink-muted">Accum. dep.</span>
                  <span className="font-mono tabular-nums text-zoru-ink-muted">
                    {fmtMoney(
                      asset.accumulatedDepreciation,
                      asset.currency,
                    )}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Custodian</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              {asset.custodianEmployeeId ? (
                <EntityPickerChip
                  entity="employee"
                  id={asset.custodianEmployeeId}
                />
              ) : (
                <span className="text-[12.5px] text-zoru-ink-muted">
                  Unassigned
                </span>
              )}
              <div className="mt-2 text-[12.5px]">
                <span className="text-zoru-ink-muted">Location: </span>
                <span>{asset.location || '—'}</span>
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Compliance</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">Warranty</span>
                  <span>{fmtDate(asset.warrantyUntil)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">Insurance</span>
                  <span>{fmtDate(asset.insuranceUntil)}</span>
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Related</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="flex flex-col gap-2 text-[12.5px]">
                <Link
                  href={`/dashboard/crm/fixed-assets/${id}/maintenance`}
                  className="text-zoru-primary hover:underline"
                >
                  Maintenance log →
                </Link>
                {asset.amcContractId ? (
                  <Link
                    href={`/dashboard/crm/service-contracts/${asset.amcContractId}`}
                    className="text-zoru-primary hover:underline"
                  >
                    AMC contract →
                  </Link>
                ) : (
                  <span className="text-zoru-ink-muted">No AMC linked</span>
                )}
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
            <Field label="Asset code">{asset.code || '—'}</Field>
            <Field label="Asset name">{asset.name || '—'}</Field>
            <Field label="Category">{asset.category || '—'}</Field>
            <Field label="Condition">
              <Badge variant="outline">{condition}</Badge>
            </Field>
            <Field label="Currency">{asset.currency || '—'}</Field>
            <Field label="Location">{asset.location || '—'}</Field>
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Cost &amp; depreciation</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <table className="w-full text-[13px]">
            <tbody>
              <tr className="border-b border-zoru-line/60">
                <td className="py-2 text-zoru-ink-muted">Purchase date</td>
                <td className="py-2 text-right">
                  {fmtDate(asset.purchaseDate)}
                </td>
              </tr>
              <tr className="border-b border-zoru-line/60">
                <td className="py-2 text-zoru-ink-muted">Cost</td>
                <td className="py-2 text-right font-mono tabular-nums">
                  {fmtMoney(asset.cost, asset.currency)}
                </td>
              </tr>
              <tr className="border-b border-zoru-line/60">
                <td className="py-2 text-zoru-ink-muted">Method</td>
                <td className="py-2 text-right">
                  {methodLabel(asset.depreciationMethod)}
                </td>
              </tr>
              <tr className="border-b border-zoru-line/60">
                <td className="py-2 text-zoru-ink-muted">
                  Useful life (months)
                </td>
                <td className="py-2 text-right">
                  {asset.usefulLifeMonths ?? '—'}
                </td>
              </tr>
              <tr className="border-b border-zoru-line/60">
                <td className="py-2 text-zoru-ink-muted">Residual value</td>
                <td className="py-2 text-right font-mono tabular-nums">
                  {fmtMoney(asset.residualValue, asset.currency)}
                </td>
              </tr>
              <tr className="border-b border-zoru-line/60">
                <td className="py-2 text-zoru-ink-muted">
                  Accumulated depreciation
                </td>
                <td className="py-2 text-right font-mono tabular-nums">
                  {fmtMoney(asset.accumulatedDepreciation, asset.currency)}
                </td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Net book value</td>
                <td className="py-2 text-right font-mono font-medium tabular-nums">
                  {fmtMoney(asset.netBookValue, asset.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </ZoruCardContent>
      </Card>

      <DepreciationScheduleCard asset={asset} />

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Custodian &amp; vendor</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Custodian">
              {asset.custodianEmployeeId ? (
                <EntityPickerChip
                  entity="employee"
                  id={asset.custodianEmployeeId}
                />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Supplier / vendor">
              {asset.supplierId ? (
                <EntityPickerChip entity="vendor" id={asset.supplierId} />
              ) : (
                '—'
              )}
            </Field>
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Insurance &amp; warranty</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Warranty until">
              {fmtDate(asset.warrantyUntil)}
            </Field>
            <Field label="Insurance until">
              {fmtDate(asset.insuranceUntil)}
            </Field>
          </div>
        </ZoruCardContent>
      </Card>

      <CustodyHistoryCard assetId={id} />

      <MaintenanceLogCard assetId={id} currency={asset.currency} />

      <p className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(asset.createdAt || asset.audit?.createdAt)} · Updated{' '}
        {fmtDate(asset.updatedAt || asset.audit?.updatedAt)}
      </p>
    </EntityDetailShell>
  );
}
