import { Badge, Button, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
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
import { Suspense } from 'react';

import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';

import { getCrmStockAdjustmentById } from '@/app/actions/crm-inventory.actions';

import { AdjustmentDetailActions } from '../_components/adjustment-detail-actions';
import { PrintButton } from '../_components/print-button';
import { AdjustmentAttachments } from '../_components/adjustment-attachments';
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
    return Number.isNaN(d.getTime())
        ? '—'
        : new Intl.DateTimeFormat('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          }).format(d);
}

function fmtDateOnly(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime())
        ? '—'
        : new Intl.DateTimeFormat('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
          }).format(d);
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
            audit={
                <Suspense fallback={<div className="p-4 text-sm text-[var(--st-text-tertiary)]">Loading activity...</div>}>
                    <EntityAuditTimeline entityKind="stock_adjustment" entityId={id} />
                </Suspense>
            }
        >
            <Card>
                <CardHeader>
                    <CardTitle>Header</CardTitle>
                </CardHeader>
                <CardBody>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Adjustment #</dt>
                            <dd className="font-mono text-[var(--st-text)] dark:text-white">
                                {number}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Date</dt>
                            <dd className="text-[var(--st-text)] dark:text-white">
                                {fmtDate(adj.date)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Reason</dt>
                            <dd>
                                <Badge variant="secondary">{adj.reason}</Badge>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Warehouse</dt>
                            <dd className="text-[var(--st-text)] dark:text-white">
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
                                <dt className="text-xs text-[var(--st-text)]">Reference</dt>
                                <dd className="text-[var(--st-text)] dark:text-white">
                                    {adj.referenceNumber}
                                </dd>
                            </div>
                        ) : null}
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Total impact</dt>
                            <dd className="font-mono text-[var(--st-text)] dark:text-white">
                                {totalImpact.toLocaleString('en-IN', {
                                    maximumFractionDigits: 2,
                                })}
                            </dd>
                        </div>
                    </dl>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Line items</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-[12.5px]">
                            <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
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
                                                className="border-t border-[var(--st-border)]"
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
                                                            ? 'text-[var(--st-text)]'
                                                            : delta < 0
                                                              ? 'text-[var(--st-text)]'
                                                              : 'text-[var(--st-text-secondary)]',
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
                                    <tr className="border-t border-[var(--st-border)]">
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
                                                    ? 'text-[var(--st-text)]'
                                                    : qty < 0
                                                      ? 'text-[var(--st-text)]'
                                                      : 'text-[var(--st-text-secondary)]',
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
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Approval workflow</CardTitle>
                </CardHeader>
                <CardBody>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Status</dt>
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
                            <dt className="text-xs text-[var(--st-text)]">Approver</dt>
                            <dd className="text-[var(--st-text)] dark:text-white">
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
                            <dt className="text-xs text-[var(--st-text)]">Approved at</dt>
                            <dd className="text-[var(--st-text)] dark:text-white">
                                {fmtDateOnly(adj.approvedAt)}
                            </dd>
                        </div>
                        {adj.approvalNotes ? (
                            <div className="sm:col-span-2">
                                <dt className="text-xs text-[var(--st-text)]">Notes</dt>
                                <dd className="whitespace-pre-wrap text-[var(--st-text)] dark:text-white">
                                    {adj.approvalNotes}
                                </dd>
                            </div>
                        ) : null}
                    </dl>
                </CardBody>
            </Card>

            {adj.notes ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Notes</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <p className="whitespace-pre-wrap text-sm text-[var(--st-text)] dark:text-white">
                            {adj.notes}
                        </p>
                    </CardBody>
                </Card>
            ) : null}

            {adj.attachments && adj.attachments.length > 0 ? (
                <Card className="print:hidden">
                    <CardHeader>
                        <CardTitle>Attachments</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <AdjustmentAttachments attachments={adj.attachments} />
                    </CardBody>
                </Card>
            ) : null}
        </EntityDetailShell>
    );
}
