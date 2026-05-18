import { ZoruButton, ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import {
    FileMinus,
  Pencil,
  ArrowLeft,
  Activity,
  Printer,
  Mail,
  } from 'lucide-react';

/**
 * Credit note detail — `/dashboard/crm/sales/credit-notes/[id]`.
 *
 * Server component per §1D.2: header card, line items, money summary,
 * refund block, LineageRail, and the full action group
 * (Edit · Mark Refunded · Print · Email · Archive · Activity).
 */

import Link from 'next/link';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
// `<StatusPill>` lives inside `<CreditNoteInlineStatus>` now.
import { LineageRail } from '@/components/crm/lineage-rail';
import { getCreditNote } from '@/app/actions/crm/credit-notes.actions';
import { CreditNoteDetailActions } from '../_components/credit-note-detail-actions';
import { CreditNoteInlineStatus } from '../_components/credit-note-inline-status';

export const dynamic = 'force-dynamic';

function fmtMoney(value: number | undefined, currency?: string): string {
    if (typeof value !== 'number') return '—';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency || 'INR',
            maximumFractionDigits: 2,
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

export default async function CreditNoteDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { creditNote, error } = await getCreditNote(id);

    if (!creditNote) {
        if (error) {
            return (
                <div className="flex w-full flex-col gap-4 p-6">
                    <p className="text-[14px] text-zoru-ink">
                        Couldn&apos;t load this credit note — {error}
                    </p>
                    <ZoruButton variant="outline" asChild>
                        <Link href="/dashboard/crm/sales/credit-notes">
                            <ArrowLeft className="h-4 w-4" /> Back to Credit Notes
                        </Link>
                    </ZoruButton>
                </div>
            );
        }
        notFound();
    }

    const title = creditNote.cnNo || String(creditNote._id);
    const currency = creditNote.currency || 'INR';
    const status = creditNote.status || 'draft';

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={title}
                subtitle="Credit note"
                icon={FileMinus}
                actions={
                    <>
                        <ZoruButton variant="outline" asChild>
                            <Link href="/dashboard/crm/sales/credit-notes">
                                <ArrowLeft className="h-4 w-4" /> Back
                            </Link>
                        </ZoruButton>
                        <ZoruButton variant="outline" asChild>
                            <Link href={`/dashboard/crm/sales/credit-notes/${id}/activity`}>
                                <Activity className="h-4 w-4" /> Activity
                            </Link>
                        </ZoruButton>
                        <CreditNoteDetailActions id={id} currentStatus={status} />
                        <ZoruButton variant="outline" disabled title="Coming soon">
                            <Printer className="h-4 w-4" /> Print
                        </ZoruButton>
                        <ZoruButton variant="outline" disabled title="Coming soon">
                            <Mail className="h-4 w-4" /> Email
                        </ZoruButton>
                        <ZoruButton asChild>
                            <Link href={`/dashboard/crm/sales/credit-notes/${id}/edit`}>
                                <Pencil className="h-4 w-4" /> Edit
                            </Link>
                        </ZoruButton>
                    </>
                }
            />

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-6">
                    <ZoruCard className="p-6">
                        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Header
                        </h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Credit note #">{creditNote.cnNo || '—'}</Field>
                            <Field label="Date">{fmtDate(creditNote.date)}</Field>
                            <Field label="Customer">
                                {creditNote.clientId ? (
                                    <EntityPickerChip entity="client" id={creditNote.clientId} />
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Linked invoice">
                                {creditNote.linkedInvoiceId ? (
                                    <Link
                                        className="text-zoru-primary hover:underline"
                                        href={`/dashboard/crm/sales/invoices/${creditNote.linkedInvoiceId}`}
                                    >
                                        {creditNote.linkedInvoiceId.slice(-8)}
                                    </Link>
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Reason">{creditNote.reason || '—'}</Field>
                            <Field label="Status">
                                <CreditNoteInlineStatus id={id} status={status} />
                            </Field>
                        </div>
                    </ZoruCard>

                    <ZoruCard className="overflow-hidden p-0">
                        <div className="border-b border-zoru-line p-4">
                            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                                Line items
                            </h3>
                        </div>
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Description</ZoruTableHead>
                                    <ZoruTableHead>HSN/SAC</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Qty</ZoruTableHead>
                                    <ZoruTableHead>Unit</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Rate</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Disc %</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Tax %</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Line total</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {(creditNote.items ?? []).length === 0 ? (
                                    <ZoruTableRow>
                                        <ZoruTableCell
                                            colSpan={8}
                                            className="h-20 text-center text-[13px] text-zoru-ink-muted"
                                        >
                                            No line items.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    (creditNote.items ?? []).map((item, idx) => (
                                        <ZoruTableRow key={idx}>
                                            <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                                                {item.description || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                                {item.hsnSac || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right tabular-nums text-[12.5px]">
                                                {item.qty}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                                {item.unit || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right tabular-nums text-[12.5px]">
                                                {fmtMoney(item.rate, currency)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right tabular-nums text-[12.5px]">
                                                {item.discountPct != null ? `${item.discountPct}%` : '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right tabular-nums text-[12.5px]">
                                                {item.taxRatePct != null ? `${item.taxRatePct}%` : '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right tabular-nums text-[12.5px]">
                                                {fmtMoney(item.total, currency)}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </ZoruCard>

                    <ZoruCard className="p-6">
                        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Refund & notes
                        </h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Refund mode">{creditNote.refundMode || '—'}</Field>
                            <Field label="Refund txn ID">{creditNote.refundTxnId || '—'}</Field>
                            <Field label="Tax recalculated">
                                {creditNote.taxRecalc ? 'Yes' : 'No'}
                            </Field>
                            <Field label="Currency">{creditNote.currency || '—'}</Field>
                        </div>
                        {creditNote.notes ? (
                            <div className="mt-4">
                                <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                                    Notes
                                </div>
                                <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                                    {creditNote.notes}
                                </div>
                            </div>
                        ) : null}
                    </ZoruCard>

                    <div className="text-[11px] text-zoru-ink-muted">
                        Created {fmtDate(creditNote.createdAt || creditNote.audit?.createdAt)} ·
                        Updated {fmtDate(creditNote.updatedAt || creditNote.audit?.updatedAt)}
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <ZoruCard className="p-6">
                        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Money summary
                        </h3>
                        <div className="flex flex-col gap-3 text-[13px] tabular-nums">
                            <div className="flex items-center justify-between text-zoru-ink-muted">
                                <span>Subtotal</span>
                                <span className="text-zoru-ink">
                                    {fmtMoney(creditNote.totals?.subTotal, currency)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-zoru-ink-muted">
                                <span>Overall discount</span>
                                <span>{fmtMoney(creditNote.totals?.discountOverall, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between text-zoru-ink-muted">
                                <span>Shipping</span>
                                <span>{fmtMoney(creditNote.totals?.shippingCharge, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between text-zoru-ink-muted">
                                <span>Adjustment</span>
                                <span>{fmtMoney(creditNote.totals?.adjustment, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between text-zoru-ink-muted">
                                <span>Round off</span>
                                <span>{fmtMoney(creditNote.totals?.roundOff, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-zoru-line pt-3 text-[14px] font-semibold text-zoru-ink">
                                <span>Total</span>
                                <span>{fmtMoney(creditNote.totals?.total, currency)}</span>
                            </div>
                        </div>
                    </ZoruCard>

                    <LineageRail
                        current={{
                            kind: 'creditNote',
                            id,
                            no: creditNote.cnNo,
                            status,
                        }}
                        lineage={(creditNote.lineage ?? []) as any}
                    />
                </div>
            </div>

            <EntityAuditTimeline entityKind="creditNote" entityId={id} />
        </div>
    );
}
