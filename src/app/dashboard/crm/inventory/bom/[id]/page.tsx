import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { notFound } from 'next/navigation';

/**
 * BOM detail page (server component) — §1D.2 bar.
 *
 * Header: 8 actions via <BomDetailActions />.
 * Body: header card · components table · costs rollup.
 * Right rail: versions/variants list + related production orders.
 * Footer: audit timeline via `audit` prop on <EntityDetailShell>.
 */

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import {
  getBomVersionsForFinishedGood,
  getCrmBomById,
  getProductionOrdersForBom,
} from '@/app/actions/crm-bom.actions';

import { BomDetailActions } from '../_components/bom-detail-actions';
import { BomDetailRail } from '../_components/bom-detail-rail';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function statusTone(status: string | undefined): EntityStatusTone {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'approved' || s === 'closed') return 'green';
  if (s === 'draft' || s === 'pending') return 'neutral';
  if (s === 'cancelled' || s === 'expired' || s === 'archived') return 'red';
  return 'amber';
}

function fmtINR(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `INR ${value}`;
  }
}

export default async function BomDetailPage({ params }: PageProps) {
  const { id } = await params;
  const bom = await getCrmBomById(id);
  if (!bom) notFound();

  const components = Array.isArray((bom as any).components) ? (bom as any).components : [];
  const title = (bom as any).bomNo || (bom as any).finishedGoodName || 'BOM';
  const active = (bom as any).active === true || (bom as any).status === 'active';
  const finishedGoodId =
    (bom as any).finishedGoodId && typeof (bom as any).finishedGoodId !== 'string'
      ? (bom as any).finishedGoodId.toString?.()
      : (bom as any).finishedGoodId;

  const [versions, productionOrders] = await Promise.all([
    getBomVersionsForFinishedGood(finishedGoodId, id),
    getProductionOrdersForBom(id),
  ]);

  const materialCost = components.reduce((sum: number, c: any) => {
    const qty = Number.isFinite(c.qty) ? c.qty : 0;
    const cost = Number.isFinite(c.costPerUnit ?? 0) ? c.costPerUnit ?? 0 : 0;
    const scrapMul = 1 + ((Number.isFinite(c.scrapPct) ? c.scrapPct : 0) / 100);
    return sum + qty * cost * scrapMul;
  }, 0);
  const labour = (bom as any).labourCost ?? 0;
  const overhead = (bom as any).overheadCost ?? 0;
  const total = (bom as any).totalCost ?? materialCost + labour + overhead;

  return (
    <EntityDetailShell
      eyebrow="BILL OF MATERIALS"
      title={title}
      status={{ label: (bom as any).status || 'draft', tone: statusTone((bom as any).status) }}
      back={{ href: '/dashboard/crm/inventory/bom', label: 'Back to all BOMs' }}
      actions={
        <BomDetailActions
          bomId={id}
          bomNo={(bom as any).bomNo || ''}
          finishedGoodName={(bom as any).finishedGoodName || ''}
          active={active}
        />
      }
      rightRail={<BomDetailRail versions={versions} productionOrders={productionOrders} />}
      audit={<EntityAuditTimeline entityKind="bom" entityId={id} />}
    >
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Header</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">BOM code</dt>
              <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                {(bom as any).bomNo || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Finished good</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {(bom as any).finishedGoodName || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Output qty</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {typeof (bom as any).outputQty === 'number' ? (bom as any).outputQty : '—'}{' '}
                {(bom as any).unit || ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Version</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{(bom as any).version || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Effective date</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {formatDate((bom as any).effectiveDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Created</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {formatDate((bom as any).createdAt)}
              </dd>
            </div>
            {(bom as any).notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">Notes</dt>
                <dd className="whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
                  {(bom as any).notes}
                </dd>
              </div>
            ) : null}
          </dl>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Components ({components.length})</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {components.length === 0 ? (
            <p className="text-sm text-zinc-500">No components yet.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Item</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Qty</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Unit</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">
                      Scrap %
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">
                      Cost / unit
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">
                      Optional
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((c: any, idx: number) => (
                    <tr
                      key={`${c.itemName}-${idx}`}
                      className="border-t border-zinc-200 dark:border-zinc-800"
                    >
                      <td className="px-3 py-2">{c.itemName || '—'}</td>
                      <td className="px-3 py-2 text-right">{c.qty}</td>
                      <td className="px-3 py-2">{c.unit || '—'}</td>
                      <td className="px-3 py-2 text-right">{c.scrapPct ?? 0}</td>
                      <td className="px-3 py-2 text-right">{fmtINR(c.costPerUnit)}</td>
                      <td className="px-3 py-2">{c.optional ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Cost rollup</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-zinc-500">Material cost</dt>
              <dd className="font-mono text-zinc-900 dark:text-zinc-100">{fmtINR(materialCost)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Labour cost</dt>
              <dd className="font-mono text-zinc-900 dark:text-zinc-100">{fmtINR(labour)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Overhead cost</dt>
              <dd className="font-mono text-zinc-900 dark:text-zinc-100">{fmtINR(overhead)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Total cost</dt>
              <dd className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {fmtINR(total)}
              </dd>
            </div>
          </dl>
        </ZoruCardContent>
      </ZoruCard>
    </EntityDetailShell>
  );
}
