import { Badge, Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/sabcrm/20ui/compat';
import { Table, ZoruTableHeader, ZoruTableBody, ZoruTableRow, ZoruTableHead, ZoruTableCell } from '@/components/sabcrm/20ui/compat';
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
import { StockTransferDetailTabs } from '../_components/stock-transfer-detail-tabs';
import { fmtDate } from '@/lib/utils';

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
                                <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
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
                                <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
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
                                    <dt className="text-xs text-[var(--st-text)]">
                                        Line items
                                    </dt>
                                    <dd className="font-mono">
                                        {lineItems.length}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-xs text-[var(--st-text)]">
                                        Total quantity
                                    </dt>
                                    <dd className="font-mono">{totalQty}</dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-xs text-[var(--st-text)]">
                                        Attachments
                                    </dt>
                                    <dd className="font-mono">
                                        {attachments.length}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-xs text-[var(--st-text)]">Created</dt>
                                    <dd>{fmtDate(transfer.createdAt)}</dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-xs text-[var(--st-text)]">Updated</dt>
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
            <StockTransferDetailTabs>
                {{
                    overview: (
                        <Card>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Header</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Transfer #</dt>
                            <dd className="font-mono text-[var(--st-text)] dark:text-white">
                                {number}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Date</dt>
                            <dd className="text-[var(--st-text)] dark:text-white">
                                {fmtDate(transfer.transferDate)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Status</dt>
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
                    ),
                    items: (
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Line items</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="w-full text-[12.5px]">
                            <ZoruTableHeader className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                                <ZoruTableRow>
                                    <ZoruTableHead className="px-3 py-2 text-left font-medium">
                                        Item
                                    </ZoruTableHead>
                                    <ZoruTableHead className="px-3 py-2 text-right font-medium">
                                        Quantity
                                    </ZoruTableHead>
                                    <ZoruTableHead className="px-3 py-2 text-left font-medium">
                                        Unit
                                    </ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {lineItems.length > 0 ? (
                                    lineItems.map((l, idx) => (
                                        <ZoruTableRow
                                            key={idx}
                                            className="border-t border-[var(--st-border)]"
                                        >
                                            <ZoruTableCell className="px-3 py-2">
                                                <EntityPickerChip
                                                    entity="item"
                                                    id={String(l.itemId)}
                                                    fallback={l.itemName || 'Item'}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="px-3 py-2 text-right font-mono">
                                                {l.quantity}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="px-3 py-2">
                                                {l.unit || '—'}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                ) : (
                                    <ZoruTableRow className="border-t border-[var(--st-border)]">
                                        <ZoruTableCell
                                            colSpan={3}
                                            className="px-3 py-4 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No line items
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                )}
                            </ZoruTableBody>
                        </Table>
                    </div>
                </ZoruCardContent>
            </Card>
                    ),
                    notes: (
                        <div className="space-y-4">
            {transfer.notes ? (
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Notes</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <p className="whitespace-pre-wrap text-sm text-[var(--st-text)] dark:text-white">
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
                                    className="flex items-center justify-between gap-2 rounded-md border border-[var(--st-border)] px-2.5 py-1.5 text-[12.5px]"
                                >
                                    <a
                                        href={a.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="truncate text-zoru-link hover:underline"
                                    >
                                        {a.name}
                                    </a>
                                    <span className="text-[var(--st-text-secondary)]">
                                        {fmtSize(a.size)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </ZoruCardContent>
                </Card>
            ) : null}
            {!transfer.notes && attachments.length === 0 && (
                <div className="text-center text-sm text-[var(--st-text-secondary)] py-8 border rounded-lg">No notes or attachments</div>
            )}
                        </div>
                    )
                }}
            </StockTransferDetailTabs>
        </EntityDetailShell>
    );
}
