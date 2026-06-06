import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Progress, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/sabcrm/20ui/compat';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

/**
 * Production-order detail page — §1D.2 bar.
 *
 * Header: 7+ actions via <PoDetailActions /> (Edit · Release · Start ·
 * Complete · Update yield · Print · Cancel). Activity sub-route is
 * deferred (see CRM_REBUILD_PLAN.md §1D scope cap).
 *
 * Body cards:
 *   • Header card (order metadata)
 *   • Component-consumption table (from BOM)
 *   • Yield / scrap progress
 *   • Cost rollup (material + labour + overhead = total)
 *
 * Right rail: BOM ref summary card.
 */
import Link from 'next/link';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';

import { getProductionOrderById } from '@/app/actions/crm-production-orders.actions';
import { fmtDate, fmtINR } from '@/lib/utils';

import { PoDetailActions } from '../_components/po-detail-actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ orderId: string }>;
}



function statusTone(status: string | undefined): EntityStatusTone {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'closed') return 'green';
  if (s === 'in_progress' || s === 'released') return 'amber';
  if (s === 'cancelled') return 'red';
  if (s === 'planned' || s === 'draft') return 'neutral';
  return 'blue';
}

export default async function ProductionOrderDetailPage({ params }: PageProps) {
  const { orderId } = await params;
  const order = await getProductionOrderById(orderId);
  if (!order) notFound();

  const planned = order.plannedQty ?? 0;
  const actual = order.actualYield ?? 0;
  const scrap = order.scrap ?? Math.max(planned - actual, 0);
  const yieldPct =
    planned > 0 ? Math.min(Math.round((actual / planned) * 100), 100) : 0;
  const scrapPct =
    planned > 0 ? Math.min(Math.round((scrap / planned) * 100), 100) : 0;

  const components = Array.isArray(order.components) ? order.components : [];
  const materialCost =
    typeof order.materialCost === 'number'
      ? order.materialCost
      : components.reduce(
          (sum, c) => sum + (c.qty || 0) * (c.costPerUnit ?? 0),
          0,
        );
  const labour = order.labourCost ?? 0;
  const overhead = order.overheadCost ?? 0;
  const total = order.totalCost ?? materialCost + labour + overhead;

  return (
    <EntityDetailShell
      eyebrow="PRODUCTION ORDER"
      title={order.orderNo || 'Production order'}
      status={{ label: order.status || 'planned', tone: statusTone(order.status) }}
      back={{
        href: '/dashboard/crm/inventory/production-orders',
        label: 'Back to all orders',
      }}
      actions={
        <PoDetailActions
          orderId={orderId}
          orderNo={order.orderNo || ''}
          currentStatus={order.status || 'planned'}
        />
      }
      rightRail={
        <div className="flex flex-col gap-4">
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>BOM reference</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="text-[13px]">
              {order.bomRef || order.bomId ? (
                <>
                  <div className="font-mono text-[var(--st-text)]">
                    {order.bomRef || order.bomId}
                  </div>
                  {order.bomId ? (
                    <Link
                      href={`/dashboard/crm/inventory/bom/${order.bomId}`}
                      className="mt-1 inline-block text-[12px] text-[var(--st-text)] hover:underline"
                    >
                      Open BOM →
                    </Link>
                  ) : null}
                </>
              ) : (
                <span className="text-[var(--st-text-secondary)]">No BOM linked.</span>
              )}
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Cost rollup</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12.5px]">
                <dt className="text-[var(--st-text-secondary)]">Material</dt>
                <dd className="text-right font-mono text-[var(--st-text)]">
                  {fmtINR(materialCost)}
                </dd>
                <dt className="text-[var(--st-text-secondary)]">Labour</dt>
                <dd className="text-right font-mono text-[var(--st-text)]">{fmtINR(labour)}</dd>
                <dt className="text-[var(--st-text-secondary)]">Overhead</dt>
                <dd className="text-right font-mono text-[var(--st-text)]">{fmtINR(overhead)}</dd>
                <dt className="border-t border-[var(--st-border)] pt-1 text-[var(--st-text)]">Total</dt>
                <dd className="border-t border-[var(--st-border)] pt-1 text-right font-mono font-semibold text-[var(--st-text)]">
                  {fmtINR(total)}
                </dd>
              </dl>
            </ZoruCardContent>
          </Card>
        </div>
      }
      audit={
        <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]" />}>
          <EntityAuditTimeline entityKind="production_order" entityId={orderId} />
        </Suspense>
      }
    >
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Order header</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--st-text)]">PO #</dt>
              <dd className="font-mono text-[var(--st-text)] dark:text-white">
                {order.orderNo || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">BOM reference</dt>
              <dd className="text-[var(--st-text)] dark:text-white">
                {order.bomRef || order.bomId || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Finished good</dt>
              <dd className="text-[var(--st-text)] dark:text-white">
                {order.finishedGoodName || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Planned qty</dt>
              <dd className="text-[var(--st-text)] dark:text-white">
                {planned} {order.unit ?? ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Actual yield</dt>
              <dd className="text-[var(--st-text)] dark:text-white">
                {actual} {order.unit ?? ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Scrap</dt>
              <dd className="text-[var(--st-text)] dark:text-white">{scrap}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Machine / line</dt>
              <dd className="text-[var(--st-text)] dark:text-white">
                {order.machineId || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Operator</dt>
              <dd className="text-[var(--st-text)] dark:text-white">
                {order.machineOperator || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Planned start</dt>
              <dd className="text-[var(--st-text)] dark:text-white">
                {fmtDate(order.plannedStart)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--st-text)]">Planned end</dt>
              <dd className="text-[var(--st-text)] dark:text-white">
                {fmtDate(order.plannedEnd)}
              </dd>
            </div>
            {order.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--st-text)]">Notes</dt>
                <dd className="whitespace-pre-wrap text-[var(--st-text)] dark:text-white">
                  {order.notes}
                </dd>
              </div>
            ) : null}
          </dl>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Yield & scrap</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="flex flex-col gap-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-[12.5px]">
              <span className="text-[var(--st-text-secondary)]">Yield</span>
              <span className="font-mono text-[var(--st-text)]">
                {actual} / {planned} ({yieldPct}%)
              </span>
            </div>
            <Progress value={yieldPct} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[12.5px]">
              <span className="text-[var(--st-text-secondary)]">Scrap</span>
              <span className="font-mono text-[var(--st-text)]">
                {scrap} ({scrapPct}%)
              </span>
            </div>
            <Progress value={scrapPct} />
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Component consumption ({components.length})</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {components.length === 0 ? (
            <p className="text-sm text-[var(--st-text)]">
              No component snapshot for this order — pick a BOM during creation to
              populate planned consumption.
            </p>
          ) : (
            <div className="overflow-x-auto rounded border border-[var(--st-border)] dark:border-[var(--st-border)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Cost / unit</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {components.map((c: any, idx: number) => {
                    const sub = (c.qty || 0) * (c.costPerUnit ?? 0);
                    return (
                      <TableRow key={`${c.itemName}-${idx}`}>
                        <TableCell>{c.itemName || '—'}</TableCell>
                        <TableCell className="text-right">{c.qty}</TableCell>
                        <TableCell>{c.unit || '—'}</TableCell>
                        <TableCell className="text-right">{fmtINR(c.costPerUnit)}</TableCell>
                        <TableCell className="text-right">{fmtINR(sub)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </ZoruCardContent>
      </Card>
    </EntityDetailShell>
  );
}
