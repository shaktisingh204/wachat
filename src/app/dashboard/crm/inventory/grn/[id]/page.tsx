import { Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  notFound } from 'next/navigation';
import {
  Pencil,
  Activity,
  Printer,
  Receipt,
  ArrowLeft,
} from 'lucide-react';

/**
 * GRN detail — `/dashboard/crm/inventory/grn/[id]`.
 *
 * Server component per §1D.2: hydrates the GRN via the Rust client,
 * renders the header card, vehicle/transport info card (when present),
 * line items table (serial numbers / batch / expiry shown inline), and
 * a LineageRail on the right (PO → GRN → Bill).
 *
 * Actions group: Edit · Accept · Convert to Bill · Print · Archive ·
 * Activity · Back.
 */

import Link from 'next/link';
import { Suspense } from 'react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getGrn } from '@/app/actions/crm/grns.actions';
import { GrnDetailActions } from '../_components/grn-detail-actions';
import { GrnTabsClient } from '../_components/grn-tabs-client';
import type { LineageRef } from '@/lib/definitions';
import { fmtDate, fmtQty } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                {label}
            </div>
            <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
        </div>
    );
}

export default async function GrnDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { grn, error } = await getGrn(id);

    if (!grn) {
        if (error) {
            return (
                <div className="flex w-full flex-col gap-4 p-6">
                    <p className="text-[14px] text-[var(--st-text)]">
                        Couldn&apos;t load this GRN — {error}
                    </p>
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/crm/inventory/grn">
                            <ArrowLeft className="h-4 w-4" /> Back to GRNs
                        </Link>
                    </Button>
                </div>
            );
        }
        notFound();
    }

    const items = grn.items ?? [];
    const status = typeof grn.status === 'string' ? grn.status : 'draft';
    const title = grn.grnNo || `GRN ${id.slice(-6)}`;

    // Loose-shaped extras carried forward from the legacy form (transport
    // details, photos). They're not on the Rust DTO yet — read defensively
    // so this page renders whether saved payload is new-shape or old.
    const extra = grn as unknown as {
        transportDetails?: {
            vehicleNumber?: string;
            driverName?: string;
            mode?: string;
            lrNumber?: string;
            lrDate?: string;
        };
        storeKeeperId?: string;
        notes?: string;
    };
    const transport = extra.transportDetails;

    const lineage: LineageRef[] = (grn.lineage as LineageRef[] | undefined) ?? [];
    const linkedBillId = lineage.find((l) => l.kind === 'bill')?.id;

    return (
        <EntityDetailShell
            eyebrow="GRN"
            title={title}
            status={{ label: status, tone: statusToTone(status) }}
            back={{ href: '/dashboard/crm/inventory/grn', label: 'GRNs' }}
            actions={
                <>
                    <Button variant="outline" asChild>
                        <Link href={`/dashboard/crm/inventory/grn/${id}/activity`}>
                            <Activity className="h-4 w-4" /> Activity
                        </Link>
                    </Button>
                    <GrnDetailActions id={id} currentStatus={status} />
                    <Button variant="outline" asChild>
                        <Link
                            href={`/dashboard/crm/purchases/expenses/new?fromKind=grn&fromId=${id}`}
                        >
                            <Receipt className="h-4 w-4" /> Convert to Bill
                        </Link>
                    </Button>
                    <Button variant="outline" disabled title="Coming soon">
                        <Printer className="h-4 w-4" /> Print
                    </Button>
                    <Button asChild>
                        <Link href={`/dashboard/crm/inventory/grn/${id}/edit`}>
                            <Pencil className="h-4 w-4" /> Edit
                        </Link>
                    </Button>
                </>
            }
        >

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-6">
                    {/* Header card */}
                    <Card className="p-6">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                                Header
                            </h3>
                            <StatusPill label={status} tone={statusToTone(status)} />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="GRN number">{grn.grnNo || '—'}</Field>
                            <Field label="Receipt date">{fmtDate(grn.date)}</Field>
                            <Field label="Vendor">
                                {grn.vendorId ? (
                                    <EntityPickerChip entity="vendor" id={grn.vendorId} />
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Warehouse">
                                {grn.warehouseId ? (
                                    <EntityPickerChip entity="warehouse" id={grn.warehouseId} />
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Linked PO">
                                {grn.poId ? (
                                    <Link
                                        href={`/dashboard/crm/purchases/orders/${grn.poId}`}
                                        className="text-[var(--st-text)] hover:underline"
                                    >
                                        {grn.poId.slice(-8)}
                                    </Link>
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Inspector">
                                {grn.inspectorId ? (
                                    <EntityPickerChip entity="user" id={grn.inspectorId} />
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Store-keeper">
                                {extra.storeKeeperId ? (
                                    <EntityPickerChip entity="employee" id={extra.storeKeeperId} />
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Linked bill">
                                {linkedBillId ? (
                                    <Link
                                        href={`/dashboard/crm/purchases/expenses/${linkedBillId}`}
                                        className="text-[var(--st-text)] hover:underline"
                                    >
                                        {linkedBillId.slice(-8)}
                                    </Link>
                                ) : (
                                    '—'
                                )}
                            </Field>
                        </div>
                    </Card>

                    <GrnTabsClient
                        itemsContent={
                            <Card className="overflow-hidden p-0">
                                <div className="border-b border-[var(--st-border)] p-3">
                                    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                                        Line items
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[12.5px]">
                                        <thead>
                                            <tr className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] text-left text-[var(--st-text-secondary)]">
                                                <th className="px-3 py-2 font-medium">Item</th>
                                                <th className="px-3 py-2 text-right font-medium">Ordered</th>
                                                <th className="px-3 py-2 text-right font-medium">Received</th>
                                                <th className="px-3 py-2 text-right font-medium">Accepted</th>
                                                <th className="px-3 py-2 text-right font-medium">Rejected</th>
                                                <th className="px-3 py-2 font-medium">Batch</th>
                                                <th className="px-3 py-2 font-medium">Expiry</th>
                                                <th className="px-3 py-2 font-medium">Serial nos.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={8}
                                                        className="h-20 px-3 text-center text-[var(--st-text-secondary)]"
                                                    >
                                                        No line items.
                                                    </td>
                                                </tr>
                                            ) : (
                                                items.map((it, idx) => (
                                                    <tr
                                                        key={idx}
                                                        className="border-b border-[var(--st-border)]/60 text-[var(--st-text)]"
                                                    >
                                                        <td className="px-3 py-2">
                                                            {it.itemId ? (
                                                                <EntityPickerChip
                                                                    entity="item"
                                                                    id={it.itemId}
                                                                />
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums">
                                                            {fmtQty(it.orderedQty)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums">
                                                            {fmtQty(it.receivedQty)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums">
                                                            {fmtQty(it.acceptedQty)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums">
                                                            {fmtQty(it.rejectedQty)}
                                                        </td>
                                                        <td className="px-3 py-2 text-[var(--st-text-secondary)]">
                                                            {it.batch || '—'}
                                                        </td>
                                                        <td className="px-3 py-2 text-[var(--st-text-secondary)]">
                                                            {fmtDate(it.expiry)}
                                                        </td>
                                                        <td className="px-3 py-2 text-[var(--st-text-secondary)]">
                                                            {Array.isArray(it.serialNos) &&
                                                            it.serialNos.length > 0
                                                                ? it.serialNos.join(', ')
                                                                : '—'}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        }
                        vehicleContent={
                            transport &&
                            (transport.vehicleNumber ||
                                transport.driverName ||
                                transport.lrNumber ||
                                transport.mode) ? (
                                <Card className="p-6">
                                    <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                                        Vehicle & transport
                                    </h3>
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <Field label="Vehicle number">
                                            {transport.vehicleNumber || '—'}
                                        </Field>
                                        <Field label="Driver">{transport.driverName || '—'}</Field>
                                        <Field label="Mode">{transport.mode || '—'}</Field>
                                        <Field label="LR / consignment">
                                            {transport.lrNumber || '—'}
                                        </Field>
                                        <Field label="LR date">{fmtDate(transport.lrDate)}</Field>
                                    </div>
                                </Card>
                            ) : null
                        }
                        attachmentsContent={
                            Array.isArray(grn.attachments) && grn.attachments.length > 0 ? (
                                <Card className="p-6">
                                    <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                                        Photos & attachments ({grn.attachments.length})
                                    </h3>
                                    <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                        {grn.attachments.map((a, idx) => (
                                            <li
                                                key={idx}
                                                className="overflow-hidden rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2 text-[12px] text-[var(--st-text-secondary)]"
                                            >
                                                <span className="line-clamp-2">
                                                    {a.name || a.url || `Attachment ${idx + 1}`}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </Card>
                            ) : null
                        }
                        notesContent={
                            extra.notes ? (
                                <Card className="p-6">
                                    <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                                        Notes
                                    </h3>
                                    <div className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                                        {extra.notes}
                                    </div>
                                </Card>
                            ) : null
                        }
                    />

                    <div className="text-[11px] text-[var(--st-text-secondary)]">
                        Created {fmtDate(grn.createdAt || grn.audit?.createdAt)} · Updated{' '}
                        {fmtDate(grn.updatedAt || grn.audit?.updatedAt)}
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <Card className="p-6">
                        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                            Counterpart links
                        </h3>
                        <div className="flex flex-col gap-3 text-[13px]">
                            <Field label="GIN out (issued)">
                                {grn.ginId ? (
                                    <span className="font-mono text-[12px]">{grn.ginId}</span>
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="MRN out (returned)">
                                {grn.mrnId ? (
                                    <span className="font-mono text-[12px]">{grn.mrnId}</span>
                                ) : (
                                    '—'
                                )}
                            </Field>
                        </div>
                    </Card>

                    <LineageRail
                        current={{
                            kind: 'grn',
                            id,
                            no: grn.grnNo,
                            status,
                        }}
                        lineage={lineage}
                    />
                </div>
            </div>

            <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-lg bg-[var(--st-bg-muted)]" />}>
                <EntityAuditTimeline entityKind="grn" entityId={id} />
            </Suspense>
        </EntityDetailShell>
    );
}
