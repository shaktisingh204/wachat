import { Badge, Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { History,
  Pencil,
  Printer } from 'lucide-react';

/**
 * Stock transfer detail — server route.
 *
 * Layout: <EntityDetailShell>
 *   header → Edit · Cancel · Archive · Print · Delete · Activity
 *   body
 *     ├── Header summary (number, date, status, line count)
 *     ├── Line items table
 *     ├── Notes
 *     └── Attachments
 *   rightRail
 *     ├── From warehouse chip
 *     ├── To warehouse chip
 *     └── At-a-glance stats
 *   audit: entityKind 'stock_transfer'
 */

import Link from 'next/link';

import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

import { getStockTransferById } from '@/app/actions/crm-stock-transfers.actions';

import { StockTransferDetailActions } from '../_components/stock-transfer-detail-actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/inventory/stock-transfers';

interface PageProps {
    params: Promise<{ id: string }>;
}

function statusTone(status: string): EntityStatusTone {
    const s = status || 'Draft';
    if (s === 'Received') return 'green';
    if (s === 'InTransit') return 'blue';
    if (s === 'Cancelled') return 'red';
    if (s === 'archived') return 'neutral';
    return 'amber';
}

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtSize(bytes?: number): string {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    const u = ['KB', 'MB', 'GB', 'TB'];
    let v = bytes / 1024;
    let i = 0;
    while (v >= 1024 && i < u.length - 1) {
        v /= 1024;
        i += 1;
    }
    return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

export default async function StockTransferDetailPage({ params }: PageProps) {
    const { id } = await params;
    const transfer = await getStockTransferById(id);
    if (!transfer) notFound();

    const status = String(transfer.status || 'Draft');
    const number =
        transfer.transferNumber || `ST-${String(transfer._id).slice(-6)}`;
    const lineItems = Array.isArray(transfer.lineItems)
        ? transfer.lineItems
        : [];
    const attachments = Array.isArray(transfer.attachments)
        ? transfer.attachments
        : [];
    const totalQty = lineItems.reduce(
        (sum, l) => sum + (Number(l.quantity) || 0),
        0,
    );

    return (
        <EntityDetailShell
            eyebrow="STOCK TRANSFER"
            title={number}
            status={{ label: status, tone: statusTone(status) }}
            back={{ href: BASE, label: 'Back to all transfers' }}
            actions={
                <>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`${BASE}/${id}/activity`}>
                            <History className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Activity
                        </Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link href={`${BASE}/${id}/edit`}>
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Edit
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <a href="javascript:window.print()">
                            <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Print
                        </a>
                    </Button>
                    <StockTransferDetailActions id={id} status={status} />
                </>
            }
            rightRail={
                <>
                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Warehouses</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent className="space-y-3 text-sm">
                            <div>
                                <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                    From
                                </p>
                                <EntityPickerChip
                                    entity="warehouse"
                                    id={String(transfer.fromWarehouseId)}
                                    fallback={
                                        transfer.fromWarehouseName || 'Warehouse'
                                    }
                                />
                            </div>
                            <div>
                                <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                    To
                                </p>
                                <EntityPickerChip
                                    entity="warehouse"
                                    id={String(transfer.toWarehouseId)}
                                    fallback={
                                        transfer.toWarehouseName || 'Warehouse'
                                    }
                                />
                            </div>
                        </ZoruCardContent>
                    </Card>

                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>At a glance</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <dl className="grid grid-cols-1 gap-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <dt className="text-xs text-zinc-500">
                                        Line items
                                    </dt>
                                    <dd className="font-mono">
                                        {lineItems.length}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-xs text-zinc-500">
                                        Total quantity
                                    </dt>
                                    <dd className="font-mono">{totalQty}</dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-xs text-zinc-500">
                                        Attachments
                                    </dt>
                                    <dd className="font-mono">
                                        {attachments.length}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-xs text-zinc-500">Created</dt>
                                    <dd>{fmtDate(transfer.createdAt)}</dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-xs text-zinc-500">Updated</dt>
                                    <dd>{fmtDate(transfer.updatedAt)}</dd>
                                </div>
                            </dl>
                        </ZoruCardContent>
                    </Card>
                </>
            }
            audit={
                <EntityAuditTimeline
                    entityKind="stock_transfer"
                    entityId={id}
                />
            }
        >
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Header</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-xs text-zinc-500">Transfer #</dt>
                            <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                                {number}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Date</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {fmtDate(transfer.transferDate)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Status</dt>
                            <dd>
                                <Badge
                                    variant={
                                        status === 'Received'
                                            ? 'success'
                                            : status === 'InTransit'
                                              ? 'info'
                                              : status === 'Cancelled'
                                                ? 'danger'
                                                : status === 'archived'
                                                  ? 'default'
                                                  : 'warning'
                                    }
                                >
                                    {status}
                                </Badge>
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
                                    <th className="px-3 py-2 text-left font-medium">
                                        Item
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium">
                                        Quantity
                                    </th>
                                    <th className="px-3 py-2 text-left font-medium">
                                        Unit
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.length > 0 ? (
                                    lineItems.map((l, idx) => (
                                        <tr
                                            key={idx}
                                            className="border-t border-zoru-line"
                                        >
                                            <td className="px-3 py-2">
                                                <EntityPickerChip
                                                    entity="item"
                                                    id={String(l.itemId)}
                                                    fallback={l.itemName || 'Item'}
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono">
                                                {l.quantity}
                                            </td>
                                            <td className="px-3 py-2">
                                                {l.unit || '—'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr className="border-t border-zoru-line">
                                        <td
                                            colSpan={3}
                                            className="px-3 py-4 text-center text-zoru-ink-muted"
                                        >
                                            No line items
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ZoruCardContent>
            </Card>

            {transfer.notes ? (
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Notes</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <p className="whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">
                            {transfer.notes}
                        </p>
                    </ZoruCardContent>
                </Card>
            ) : null}

            {attachments.length > 0 ? (
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Attachments</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <ul className="flex flex-col gap-1.5">
                            {attachments.map((a) => (
                                <li
                                    key={a.id}
                                    className="flex items-center justify-between gap-2 rounded-md border border-zoru-line px-2.5 py-1.5 text-[12.5px]"
                                >
                                    <a
                                        href={a.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="truncate text-zoru-link hover:underline"
                                    >
                                        {a.name}
                                    </a>
                                    <span className="text-zoru-ink-muted">
                                        {fmtSize(a.size)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </ZoruCardContent>
                </Card>
            ) : null}
        </EntityDetailShell>
    );
}
