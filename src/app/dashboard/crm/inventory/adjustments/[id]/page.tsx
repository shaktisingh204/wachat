import { Badge, Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { History,
  Pencil,
  Printer } from 'lucide-react';

/**
 * Stock Adjustment detail — server route per §1D.
 *
 * Layout: <EntityDetailShell>
 *   header → Edit · Approve · Reject · Print · Archive · Activity
 *   body
 *     ├── Header summary (date, warehouse, reason, ref)
 *     ├── Per-line breakdown table (qty before/after/delta/cost)
 *     ├── Approval workflow card (approver chip + timestamps)
 *     └── Notes card
 *   audit: entityKind 'stock_adjustment'
 */

import Link from 'next/link';

import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';

import { getCrmStockAdjustmentById } from '@/app/actions/crm-inventory.actions';

import { AdjustmentDetailActions } from '../_components/adjustment-detail-actions';
import { PrintButton } from '../_components/print-button';
import { mapToStockAdjustmentDto } from '../types';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface PageProps {
    params: Promise<{ id: string }>;
}

function statusTone(status: string): EntityStatusTone {
    const s = (status || 'pending').toLowerCase();
    if (s === 'approved') return 'green';
    if (s === 'rejected') return 'red';
    return 'amber';
}

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function fmtDateOnly(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default async function StockAdjustmentDetailPage({ params }: PageProps) {
    const { id } = await params;
    const rawAdj = await getCrmStockAdjustmentById(id);
    const adj = mapToStockAdjustmentDto(rawAdj);
    if (!rawAdj) notFound();

    const status = (adj.status as string) || 'pending';
    const qty = typeof adj.quantity === 'number' ? adj.quantity : 0;
    const cost = Number(adj.costPerUnit || 0);
    const productName = adj.productName as string | undefined;
    const warehouseName = adj.warehouseName as string | undefined;
    const number =
        adj.adjustmentNumber || `ADJ-${String(adj._id).slice(-6)}`;
    const title = `${number}${productName ? ` · ${productName}` : ''}`;
    const lines = (adj.lines) ?? [];

    const totalImpact = lines.length
        ? lines.reduce(
              (acc, l) =>
                  acc +
                  Math.abs(
                      ((l.delta ?? (l.qtyAfter ?? 0) - (l.qtyBefore ?? 0)) || 0) *
                          (l.costPerUnit || 1),
                  ),
              0,
          )
        : Math.abs(qty * (cost || 1));

    return (
        <EntityDetailShell
            eyebrow="STOCK ADJUSTMENT"
            title={title}
            status={{ label: status, tone: statusTone(status) }}
            back={{
                href: '/dashboard/crm/inventory/adjustments',
                label: 'Back to all adjustments',
            }}
            actions={
                <>
                    <Button variant="outline" size="sm" asChild>
                        <Link
                            href={`/dashboard/crm/inventory/adjustments/${id}/activity`}
                        >
                            <History className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Activity
                        </Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link
                            href={`/dashboard/crm/inventory/adjustments/${id}/edit`}
                        >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Edit
                        </Link>
                    </Button>
                    <PrintButton />
                    <AdjustmentDetailActions id={id} status={status} />
                </>
            }
            audit={<EntityAuditTimeline entityKind="stock_adjustment" entityId={id} />}
        >
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Header</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-xs text-zinc-500">Adjustment #</dt>
                            <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                                {number}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Date</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {fmtDate(adj.date)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Reason</dt>
                            <dd>
                                <Badge variant="secondary">{adj.reason}</Badge>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Warehouse</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {adj.warehouseId ? (
                                    <EntityPickerChip
                                        entity="warehouse"
                                        id={String(adj.warehouseId)}
                                        fallback={warehouseName || 'Warehouse'}
                                    />
                                ) : (
                                    warehouseName || '—'
                                )}
                            </dd>
                        </div>
                        {adj.referenceNumber ? (
                            <div>
                                <dt className="text-xs text-zinc-500">Reference</dt>
                                <dd className="text-zinc-900 dark:text-zinc-100">
                                    {adj.referenceNumber}
                                </dd>
                            </div>
                        ) : null}
                        <div>
                            <dt className="text-xs text-zinc-500">Total impact</dt>
                            <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                                {totalImpact.toLocaleString('en-IN', {
                                    maximumFractionDigits: 2,
                                })}
                            </dd>
                        </div>
                    </dl>
                </ZoruCardContent>
            </Card>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Line items</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-[12.5px]">
                            <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium">Item</th>
                                    <th className="px-3 py-2 text-right font-medium">
                                        Qty before
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium">
                                        Qty after
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium">
                                        Delta
                                    </th>
                                    <th className="px-3 py-2 text-left font-medium">
                                        Batch
                                    </th>
                                    <th className="px-3 py-2 text-left font-medium">
                                        Serial
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium">
                                        Cost/unit
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {lines.length > 0 ? (
                                    lines.map((l, idx) => {
                                        const delta =
                                            l.delta ??
                                            (l.qtyAfter ?? 0) - (l.qtyBefore ?? 0);
                                        return (
                                            <tr
                                                key={idx}
                                                className="border-t border-zoru-line"
                                            >
                                                <td className="px-3 py-2">
                                                    <Link href={`/dashboard/crm/inventory/products/${l.productId}/ledger`} className="hover:underline">
                                                        <EntityPickerChip
                                                            entity="item"
                                                            id={String(l.productId)}
                                                            fallback="Item"
                                                        />
                                                    </Link>
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono">
                                                    {l.qtyBefore ?? 0}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono">
                                                    {l.qtyAfter ?? 0}
                                                </td>
                                                <td
                                                    className={[
                                                        'px-3 py-2 text-right font-mono',
                                                        delta > 0
                                                            ? 'text-emerald-500'
                                                            : delta < 0
                                                              ? 'text-rose-500'
                                                              : 'text-zoru-ink-muted',
                                                    ].join(' ')}
                                                >
                                                    {delta > 0 ? '+' : ''}
                                                    {delta}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {l.batch || '—'}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {l.serial || '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono">
                                                    {l.costPerUnit
                                                        ? l.costPerUnit.toLocaleString(
                                                              'en-IN',
                                                              { maximumFractionDigits: 2 },
                                                          )
                                                        : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr className="border-t border-zoru-line">
                                        <td className="px-3 py-2">
                                            <Link href={`/dashboard/crm/inventory/products/${adj.productId}/ledger`} className="hover:underline">
                                                <EntityPickerChip
                                                    entity="item"
                                                    id={String(adj.productId)}
                                                    fallback={productName || 'Item'}
                                                />
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono">—</td>
                                        <td className="px-3 py-2 text-right font-mono">—</td>
                                        <td
                                            className={[
                                                'px-3 py-2 text-right font-mono',
                                                qty > 0
                                                    ? 'text-emerald-500'
                                                    : qty < 0
                                                      ? 'text-rose-500'
                                                      : 'text-zoru-ink-muted',
                                            ].join(' ')}
                                        >
                                            {qty > 0 ? '+' : ''}
                                            {qty}
                                        </td>
                                        <td className="px-3 py-2">—</td>
                                        <td className="px-3 py-2">—</td>
                                        <td className="px-3 py-2 text-right font-mono">
                                            {cost
                                                ? cost.toLocaleString('en-IN', {
                                                      maximumFractionDigits: 2,
                                                  })
                                                : '—'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ZoruCardContent>
            </Card>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Approval workflow</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-xs text-zinc-500">Status</dt>
                            <dd>
                                <Badge
                                    variant={
                                        status === 'approved'
                                            ? 'success'
                                            : status === 'rejected'
                                              ? 'danger'
                                              : 'warning'
                                    }
                                >
                                    {status}
                                </Badge>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Approver</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {adj.approvedBy ? (
                                    <EntityPickerChip
                                        entity="user"
                                        id={String(adj.approvedBy)}
                                        fallback={
                                            adj.approvedByName || 'Approver'
                                        }
                                    />
                                ) : (
                                    '—'
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Approved at</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {fmtDateOnly(adj.approvedAt)}
                            </dd>
                        </div>
                        {adj.approvalNotes ? (
                            <div className="sm:col-span-2">
                                <dt className="text-xs text-zinc-500">Notes</dt>
                                <dd className="whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
                                    {adj.approvalNotes}
                                </dd>
                            </div>
                        ) : null}
                    </dl>
                </ZoruCardContent>
            </Card>

            {adj.notes ? (
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Notes</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <p className="whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">
                            {adj.notes}
                        </p>
                    </ZoruCardContent>
                </Card>
            ) : null}
        </EntityDetailShell>
    );
}
