import { ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import {
  Pencil,
  Activity,
  Printer,
  Mail,
  } from 'lucide-react';

/**
 * Payment receipt detail — `/dashboard/crm/sales/receipts/[receiptId]`.
 *
 * Server component: hydrates the receipt via the Rust client, renders
 * the money summary, applied-invoice breakout, and lineage rail per
 * §1D.2. Action buttons (Edit · Mark Cleared · Mark Bounced · Print ·
 * Email · Archive · Activity) live in the header.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
// `<StatusPill>` lives inside `<ReceiptInlineStatus>` now.
import { LineageRail } from '@/components/crm/lineage-rail';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getPaymentReceipt } from '@/app/actions/crm/payment-receipts.actions';
import { ReceiptDetailActions } from '../_components/receipt-detail-actions';
import { ReceiptInlineStatus } from '../_components/receipt-inline-status';

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

function modeLabel(mode: string | undefined): string {
    if (!mode) return '—';
    const map: Record<string, string> = {
        cash: 'Cash',
        cheque: 'Cheque',
        upi: 'UPI',
        neft: 'NEFT',
        rtgs: 'RTGS',
        imps: 'IMPS',
        card: 'Card',
        wallet: 'Wallet',
    };
    return map[mode] ?? mode;
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

export default async function PaymentReceiptDetailPage({
    params,
}: {
    params: Promise<{ receiptId: string }>;
}) {
    const { receiptId } = await params;
    const { receipt, error } = await getPaymentReceipt(receiptId);

    if (!receipt) {
        if (error) {
            return (
                <div className="flex w-full flex-col gap-4 p-6">
                    <p className="text-[14px] text-zoru-ink">
                        Couldn&apos;t load this receipt — {error}
                    </p>
                    <ZoruButton variant="outline" asChild>
                        <Link href="/dashboard/crm/sales/receipts">
                            <ArrowLeft className="h-4 w-4" /> Back to Receipts
                        </Link>
                    </ZoruButton>
                </div>
            );
        }
        notFound();
    }

    const title = receipt.receiptNo || `Receipt ${receiptId.slice(-6)}`;
    const currency = receipt.currency || 'INR';
    const status = receipt.status || 'received';
    const totalSettled = (receipt.applyTo ?? []).reduce(
        (s, r) => s + (Number(r.amount) || 0),
        0,
    );
    const advance = Math.max(0, (Number(receipt.amount) || 0) - totalSettled);

    return (
        <EntityDetailShell
            eyebrow="RECEIPT"
            title={title}
            back={{ href: '/dashboard/crm/sales/receipts', label: 'Receipts' }}
            actions={
                <>
                    <ZoruButton variant="outline" asChild>
                        <Link href={`/dashboard/crm/sales/receipts/${receiptId}/activity`}>
                            <Activity className="h-4 w-4" /> Activity
                        </Link>
                    </ZoruButton>
                    <ReceiptDetailActions
                        id={receiptId}
                        currentStatus={status}
                    />
                    <ZoruButton variant="outline" disabled title="Coming soon">
                        <Printer className="h-4 w-4" /> Print
                    </ZoruButton>
                    <ZoruButton variant="outline" disabled title="Coming soon">
                        <Mail className="h-4 w-4" /> Email
                    </ZoruButton>
                    <ZoruButton asChild>
                        <Link href={`/dashboard/crm/sales/receipts/${receiptId}/edit`}>
                            <Pencil className="h-4 w-4" /> Edit
                        </Link>
                    </ZoruButton>
                </>
            }
        >

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-6">
                    {/* Header card */}
                    <ZoruCard className="p-6">
                        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Header
                        </h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Receipt #">{receipt.receiptNo || '—'}</Field>
                            <Field label="Date">{fmtDate(receipt.date)}</Field>
                            <Field label="Customer">
                                {receipt.clientId ? (
                                    <EntityPickerChip entity="client" id={receipt.clientId} />
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Status">
                                <ReceiptInlineStatus id={receiptId} status={status} />
                            </Field>
                            <Field label="Mode">{modeLabel(receipt.mode)}</Field>
                            <Field label="Bank account">
                                {receipt.bankAccountId ? (
                                    <EntityPickerChip
                                        entity="bankAccount"
                                        id={receipt.bankAccountId}
                                    />
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Cheque #">{receipt.chequeNo || '—'}</Field>
                            <Field label="Cheque date">{fmtDate(receipt.chequeDate)}</Field>
                            <Field label="Transaction ID">{receipt.txnId || '—'}</Field>
                            <Field label="Reference">{receipt.reference || '—'}</Field>
                        </div>
                    </ZoruCard>

                    {/* Applied invoices */}
                    <ZoruCard className="p-6">
                        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Applied to invoices ({receipt.applyTo?.length ?? 0})
                        </h3>
                        {receipt.applyTo && receipt.applyTo.length > 0 ? (
                            <ul className="flex flex-col gap-2">
                                {receipt.applyTo.map((row, idx) => (
                                    <li
                                        key={`${row.invoiceId}-${idx}`}
                                        className="flex items-center justify-between rounded-md border border-zoru-line bg-zoru-surface-2 px-3 py-2"
                                    >
                                        <Link
                                            href={`/dashboard/crm/sales/invoices/${row.invoiceId}`}
                                            className="text-[13px] font-medium text-zoru-ink hover:underline"
                                        >
                                            {row.invoiceId.slice(-8)}
                                        </Link>
                                        <span className="text-[13px] tabular-nums text-zoru-ink">
                                            {fmtMoney(row.amount, currency)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-[12.5px] text-zoru-ink-muted">
                                No invoices applied — this receipt records an advance.
                            </p>
                        )}
                    </ZoruCard>

                    {/* Deductions + notes */}
                    <ZoruCard className="p-6">
                        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Deductions & notes
                        </h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="TDS deducted">
                                {fmtMoney(receipt.tdsDeducted, currency)}
                            </Field>
                            <Field label="Bank charges">
                                {fmtMoney(receipt.bankCharges, currency)}
                            </Field>
                            <Field label="Excess as advance">
                                {receipt.excessAsAdvance ? 'Yes' : 'No'}
                            </Field>
                            <Field label="Exchange rate">
                                {receipt.exchangeRate != null
                                    ? receipt.exchangeRate.toFixed(4)
                                    : '—'}
                            </Field>
                        </div>
                        {receipt.notes ? (
                            <div className="mt-4">
                                <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                                    Notes
                                </div>
                                <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                                    {receipt.notes}
                                </div>
                            </div>
                        ) : null}
                    </ZoruCard>

                    <div className="text-[11px] text-zoru-ink-muted">
                        Created {fmtDate(receipt.createdAt || receipt.audit?.createdAt)} ·
                        Updated {fmtDate(receipt.updatedAt || receipt.audit?.updatedAt)}
                    </div>
                </div>

                {/* Right rail: money summary + lineage */}
                <div className="flex flex-col gap-4">
                    <ZoruCard className="p-6">
                        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Money summary
                        </h3>
                        <div className="flex flex-col gap-3 text-[13px] tabular-nums">
                            <div className="flex items-center justify-between text-zoru-ink-muted">
                                <span>Received</span>
                                <span className="text-zoru-ink">
                                    {fmtMoney(receipt.amount, currency)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-zoru-ink-muted">
                                <span>Settled</span>
                                <span>{fmtMoney(totalSettled, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between text-zoru-ink-muted">
                                <span>TDS</span>
                                <span>{fmtMoney(receipt.tdsDeducted, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between text-zoru-ink-muted">
                                <span>Bank charges</span>
                                <span>{fmtMoney(receipt.bankCharges, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-zoru-line pt-3 text-[14px] font-semibold text-zoru-ink">
                                <span>Advance</span>
                                <span>{fmtMoney(advance, currency)}</span>
                            </div>
                        </div>
                    </ZoruCard>

                    <LineageRail
                        current={{
                            kind: 'paymentReceipt',
                            id: receiptId,
                            no: receipt.receiptNo,
                            status,
                        }}
                        lineage={(receipt.lineage ?? []) as any}
                    />
                </div>
            </div>

            <EntityAuditTimeline entityKind="paymentReceipt" entityId={receiptId} />
        </EntityDetailShell>
    );
}
