import { Button, Card, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import {
  notFound } from 'next/navigation';
import {
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

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                {label}
            </div>
            <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
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
                    <p className="text-[14px] text-[var(--st-text)]">
                        Couldn&apos;t load this credit note — {error}
                    </p>
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/crm/sales/credit-notes">
                            <ArrowLeft className="h-4 w-4" /> Back to Credit Notes
                        </Link>
                    </Button>
                </div>
            );
        }
        notFound();
    }

    const title = creditNote.cnNo || String(creditNote._id);
    const currency = creditNote.currency || 'INR';
    const status = creditNote.status || 'draft';

    return (
        <EntityDetailShell
            eyebrow="CREDIT NOTE"
            title={title}
            back={{ href: '/dashboard/crm/sales/credit-notes', label: 'Credit Notes' }}
            actions={
                <>
                    <Button variant="outline" asChild>
                        <Link href={`/dashboard/crm/sales/credit-notes/${id}/activity`}>
                            <Activity className="h-4 w-4" /> Activity
                        </Link>
                    </Button>
                    <CreditNoteDetailActions id={id} currentStatus={status} />
                    <Button variant="outline" disabled title="Coming soon">
                        <Printer className="h-4 w-4" /> Print
                    </Button>
                    <Button variant="outline" disabled title="Coming soon">
                        <Mail className="h-4 w-4" /> Email
                    </Button>
                    <Button asChild>
                        <Link href={`/dashboard/crm/sales/credit-notes/${id}/edit`}>
                            <Pencil className="h-4 w-4" /> Edit
                        </Link>
                    </Button>
                </>
            }
        >

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-6">
                    <Card className="p-6">
                        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
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
                                        className="text-[var(--st-text)] hover:underline"
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
                    </Card>

                    <Card className="overflow-hidden p-0">
                        <div className="border-b border-[var(--st-border)] p-4">
                            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                                Line items
                            </h3>
                        </div>
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Description</Th>
                                    <Th>HSN/SAC</Th>
                                    <Th className="text-right">Qty</Th>
                                    <Th>Unit</Th>
                                    <Th className="text-right">Rate</Th>
                                    <Th className="text-right">Disc %</Th>
                                    <Th className="text-right">Tax %</Th>
                                    <Th className="text-right">Line total</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {(creditNote.items ?? []).length === 0 ? (
                                    <Tr>
                                        <Td
                                            colSpan={8}
                                            className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                                        >
                                            No line items.
                                        </Td>
                                    </Tr>
                                ) : (
                                    (creditNote.items ?? []).map((item, idx) => (
                                        <Tr key={idx}>
                                            <Td className="text-[12.5px] text-[var(--st-text)]">
                                                {item.description || '—'}
                                            </Td>
                                            <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                                                {item.hsnSac || '—'}
                                            </Td>
                                            <Td className="text-right tabular-nums text-[12.5px]">
                                                {item.qty}
                                            </Td>
                                            <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                                                {item.unit || '—'}
                                            </Td>
                                            <Td className="text-right tabular-nums text-[12.5px]">
                                                {fmtMoney(item.rate, currency)}
                                            </Td>
                                            <Td className="text-right tabular-nums text-[12.5px]">
                                                {item.discountPct != null ? `${item.discountPct}%` : '—'}
                                            </Td>
                                            <Td className="text-right tabular-nums text-[12.5px]">
                                                {item.taxRatePct != null ? `${item.taxRatePct}%` : '—'}
                                            </Td>
                                            <Td className="text-right tabular-nums text-[12.5px]">
                                                {fmtMoney(item.total, currency)}
                                            </Td>
                                        </Tr>
                                    ))
                                )}
                            </TBody>
                        </Table>
                    </Card>

                    <Card className="p-6">
                        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
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
                                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                                    Notes
                                </div>
                                <div className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                                    {creditNote.notes}
                                </div>
                            </div>
                        ) : null}
                    </Card>

                    <div className="text-[11px] text-[var(--st-text-secondary)]">
                        Created {fmtDate(creditNote.createdAt || creditNote.audit?.createdAt)} ·
                        Updated {fmtDate(creditNote.updatedAt || creditNote.audit?.updatedAt)}
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <Card className="p-6">
                        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                            Money summary
                        </h3>
                        <div className="flex flex-col gap-3 text-[13px] tabular-nums">
                            <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                                <span>Subtotal</span>
                                <span className="text-[var(--st-text)]">
                                    {fmtMoney(creditNote.totals?.subTotal, currency)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                                <span>Overall discount</span>
                                <span>{fmtMoney(creditNote.totals?.discountOverall, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                                <span>Shipping</span>
                                <span>{fmtMoney(creditNote.totals?.shippingCharge, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                                <span>Adjustment</span>
                                <span>{fmtMoney(creditNote.totals?.adjustment, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[var(--st-text-secondary)]">
                                <span>Round off</span>
                                <span>{fmtMoney(creditNote.totals?.roundOff, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-3 text-[14px] font-semibold text-[var(--st-text)]">
                                <span>Total</span>
                                <span>{fmtMoney(creditNote.totals?.total, currency)}</span>
                            </div>
                        </div>
                    </Card>

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
        </EntityDetailShell>
    );
}
