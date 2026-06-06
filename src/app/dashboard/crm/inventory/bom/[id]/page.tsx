import { Card, CardBody, CardHeader, CardTitle, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import { notFound } from 'next/navigation';
import { withTimeout } from '../lib/timeout';
import { fmtINR } from '@/lib/utils';

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
  getCrmBomById, CrmBomComponent,
  getProductionOrdersForBom,
} from '@/app/actions/crm-bom.actions';

import { BomDetailActions } from '../_components/bom-detail-actions';
import { BomDetailRail } from '../_components/bom-detail-rail';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function statusTone(status: string | undefined): EntityStatusTone {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'approved' || s === 'closed') return 'green';
  if (s === 'draft' || s === 'pending') return 'neutral';
  if (s === 'cancelled' || s === 'expired' || s === 'archived') return 'red';
  return 'amber';
}

function RightRailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Versions / variants</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <div className="space-y-3 px-4 py-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Related production orders</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <div className="space-y-3 px-4 py-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

async function RightRailContainer({ finishedGoodId, bomId }: { finishedGoodId: string | undefined, bomId: string }) {
  const [versions, productionOrders] = await withTimeout(
    Promise.all([
      getBomVersionsForFinishedGood(finishedGoodId, bomId),
      getProductionOrdersForBom(bomId),
    ]),
    10000
  );

  return <BomDetailRail versions={versions} productionOrders={productionOrders} />;
}

export default async function BomDetailPage({ params }: PageProps) {
  const { id } = await params;
  const bom = await withTimeout(getCrmBomById(id), 10000);
  if (!bom) notFound();

  const components = Array.isArray(bom.components) ? bom.components : [];
  const title = bom.bomNo || bom.finishedGoodName || 'BOM';
  const active = bom.active === true || bom.status === 'active';
  const finishedGoodId =
    bom.finishedGoodId && typeof bom.finishedGoodId !== 'string'
      ? bom.finishedGoodId.toString?.()
      : bom.finishedGoodId;

  const materialCost = components.reduce((sum: number, c: CrmBomComponent) => {
    const qty = Number.isFinite(c.qty) ? c.qty : 0;
    const cost = Number.isFinite(c.costPerUnit ?? 0) ? c.costPerUnit ?? 0 : 0;
    const scrapMul = 1 + ((Number.isFinite(c.scrapPct) ? c.scrapPct : 0) / 100);
    return sum + qty * cost * scrapMul;
  }, 0);
  const labour = bom.labourCost ?? 0;
  const overhead = bom.overheadCost ?? 0;
  const total = bom.totalCost ?? materialCost + labour + overhead;

  return (
    <EntityDetailShell
      eyebrow="BILL OF MATERIALS"
      title={title}
      status={{ label: bom.status || 'draft', tone: statusTone(bom.status) }}
      back={{ href: '/dashboard/crm/inventory/bom', label: 'Back to all BOMs' }}
      actions={
        <BomDetailActions
          bomId={id}
          bomNo={bom.bomNo || ''}
          finishedGoodName={bom.finishedGoodName || ''}
          active={active}
        />
      }
      rightRail={
        <Suspense fallback={<RightRailSkeleton />}>
          <RightRailContainer finishedGoodId={finishedGoodId} bomId={id} />
        </Suspense>
      }
      audit={<EntityAuditTimeline entityKind="bom" entityId={id} />}
    >
      <Card>
        <CardHeader>
          <CardTitle>Header</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--st-text)]">BOM code</dt>
              <dd className="font-mono text-[var(--st-text)] dark:text-white">
                {bom.bomNo || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Finished good</dt>
              <dd className="text-[var(--st-text)] dark:text-white">
                {bom.finishedGoodName || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Output qty</dt>
              <dd className="text-[var(--st-text)] dark:text-white">
                {typeof bom.outputQty === 'number' ? bom.outputQty : '—'}{' '}
                {bom.unit || ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Version</dt>
              <dd className="text-[var(--st-text)] dark:text-white">{bom.version || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Effective date</dt>
              <dd className="text-[var(--st-text)] dark:text-white">
                {formatDate(bom.effectiveDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Created</dt>
              <dd className="text-[var(--st-text)] dark:text-white">
                {formatDate(bom.createdAt)}
              </dd>
            </div>
            {bom.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--st-text)]">Notes</dt>
                <dd className="whitespace-pre-wrap text-[var(--st-text)] dark:text-white">
                  {bom.notes}
                </dd>
              </div>
            ) : null}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Components ({components.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {components.length === 0 ? (
            <p className="text-sm text-[var(--st-text)]">No components yet.</p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Item</Th>
                  <Th className="text-right">Qty</Th>
                  <Th>Unit</Th>
                  <Th className="text-right">Scrap %</Th>
                  <Th className="text-right">Cost / unit</Th>
                  <Th>Optional</Th>
                </Tr>
              </THead>
              <TBody>
                {components.map((c: CrmBomComponent, idx: number) => (
                  <Tr key={`${c.itemName}-${idx}`}>
                    <Td>{c.itemName || '—'}</Td>
                    <Td className="text-right">{c.qty}</Td>
                    <Td>{c.unit || '—'}</Td>
                    <Td className="text-right">{c.scrapPct ?? 0}</Td>
                    <Td className="text-right">{fmtINR(c.costPerUnit)}</Td>
                    <Td>{c.optional ? 'Yes' : 'No'}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost rollup</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-[var(--st-text)]">Material cost</dt>
              <dd className="font-mono text-[var(--st-text)] dark:text-white">{fmtINR(materialCost)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Labour cost</dt>
              <dd className="font-mono text-[var(--st-text)] dark:text-white">{fmtINR(labour)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Overhead cost</dt>
              <dd className="font-mono text-[var(--st-text)] dark:text-white">{fmtINR(overhead)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Total cost</dt>
              <dd className="font-mono font-semibold text-[var(--st-text)] dark:text-white">
                {fmtINR(total)}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>
    </EntityDetailShell>
  );
}
