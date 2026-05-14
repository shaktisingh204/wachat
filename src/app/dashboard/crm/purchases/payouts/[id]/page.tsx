/**
 * Payout detail — `/dashboard/crm/purchases/payouts/[id]`.
 *
 * Server component (§1D.2): hydrates the payout via the Rust client,
 * renders the money summary, applied-bill breakout, and LineageRail.
 * Action buttons (Edit · Mark Cleared · Mark Failed · Print · Archive ·
 * Activity) live in the header.
 *
 * Buy-side mirror of the receipt detail page.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    Wallet,
    Pencil,
    ArrowLeft,
    Activity,
    Printer,
    Mail,
} from 'lucide-react';

import { ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { LineageRail } from '@/components/crm/lineage-rail';
import { getPayout } from '@/app/actions/crm/payouts.actions';
import { PayoutDetailActions } from '../_components/payout-detail-actions';

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

export default async function PayoutDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { payout, error } = await getPayout(id);

    if (!payout) {
        if (error) {
            return (
                <div className="flex w-full flex-col gap-4 p-6">
                    <p className="text-[14px] text-zoru-ink">
                        Couldn&apos;t load this payout — {error}
                    </p>
                    <ZoruButton variant="outline" asChild>
                        <Link href="/dashboard/crm/purchases/payouts">
                            <ArrowLeft className="h-4 w-4" /> Back to Payouts
                        </Link>
                    </ZoruButton>
                </div>
            );
        }
        notFound();
    }

    const title = payout.paymentNo || `Payout ${id.slice(-6)}`;
    const currency = payout.currency || 'INR';
    const status = payout.status || 'sent';
    const totalSettled = (payout.applyTo ?? []).reduce(
        (s, r) => s + (Number(r.amount) || 0),
        0,
    );
    const advance = Math.max(0, (Number(payout.amount) || 0) - totalSettled);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={title}
                subtitle="Payout"
                icon={Wallet}
                actions={
                    <>
                        <ZoruButton variant="outline" asChild>
                            <Link href="/dashboard/crm/purchases/payouts">
                                <ArrowLeft className="h-4 w-4" /> Back
                            </Link>
                        </ZoruButton>
                        <ZoruButton variant="outline" asChild>
                            <Link href={`/dashboard/crm/purchases/payouts/${id}/activity`}>
                                <Activity className="h-4 w-4" /> Activity
                            </Link>
                        </ZoruButton>
                        <PayoutDetailActions id={id} currentStatus={status} />
                        <ZoruButton variant="outline" disabled title="Coming soon">
                            <Printer className="h-4 w-4" /> Print
                        </ZoruButton>
                        <ZoruButton variant="outline" disabled title="Coming soon">
                            <Mail className="h-4 w-4" /> Email
                        </ZoruButton>
                        <ZoruButton asChild>
                            <Link href={`/dashboard/crm/purchases/payouts/${id}/edit`}>
                                <Pencil className="h-4 w-4" /> Edit
                            </Link>
                        </ZoruButton>
                    </>
                }
            />

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-6">
                    {/* Header card */}
                    <ZoruCard className="p-6">
                        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Header
                        </h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Payment #">{payout.paymentNo || '—'}</Field>
                            <Field label="Date">{fmtDate(payout.date)}</Field>
                            <Field label="Vendor">
                                {payout.vendorId ? (
                                    <EntityPickerChip entity="vendor" id={payout.vendorId} />
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Status">
                                <StatusPill label={status} tone={statusToTone(status)} />
                            </Field>
                            <Field label="Mode">{modeLabel(payout.mode)}</Field>
                            <Field label="Bank account">
                                {payout.bankAccountId ? (
                                    <EntityPickerChip
                                        entity="bankAccount"
                                        id={payout.bankAccountId}
                                    />
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Cheque #">{payout.chequeNo || '—'}</Field>
                            <Field label="Cheque date">{fmtDate(payout.chequeDate)}</Field>
                            <Field label="Transaction ID">{payout.txnId || '—'}</Field>
                            <Field label="Reference">{payout.reference || '—'}</Field>
                        </div>
                    </ZoruCard>

                    {/* Applied bills */}
                    <ZoruCard className="p-6">
                        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Applied to bills ({payout.applyTo?.length ?? 0})
                        </h3>
                        {payout.applyTo && payout.applyTo.length > 0 ? (
                            <ul className="flex flex-col gap-2">
                                {payout.applyTo.map((row, idx) => (
                                    <li
                                        key={`${row.billId}-${idx}`}
                                        className="flex items-center justify-between rounded-md border border-zoru-line bg-zoru-surface-2 px-3 py-2"
                                    >
                                        <Link
                                            href={`/dashboard/crm/purchases/expenses/${row.billId}`}
                                            className="text-[13px] font-medium text-zoru-ink hover:underline"
                                        >
                                            {row.billId.slice(-8)}
                                        </Link>
                                        <span className="text-[13px] tabular-nums text-zoru-ink">
                                            {fmtMoney(row.amount, currency)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-[12.5px] text-zoru-ink-muted">
                                No bills applied — this payout records an advance.
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
                                {fmtMoney(payout.tdsDeducted, currency)}
                            </Field>
                            <Field label="Excess as advance">
                                {payout.excessAsAdvance ? 'Yes' : 'No'}
                            </Field>
                            <Field label="Exchange rate">
                                {payout.exchangeRate != null
                                    ? payout.exchangeRate.toFixed(4)
                                    : '—'}
                            </Field>
                            <Field label="Currency">{payout.currency || '—'}</Field>
                        </div>
                        {payout.notes ? (
                            <div className="mt-4">
                                <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                                    Notes
                                </div>
                                <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                                    {payout.notes}
                                </div>
                            </div>
                        ) : null}
                    </ZoruCard>

                    <div className="text-[11px] text-zoru-ink-muted">
                        Created {fmtDate(payout.createdAt || payout.audit?.createdAt)} ·
                        Updated {fmtDate(payout.updatedAt || payout.audit?.updatedAt)}
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
                                <span>Paid</span>
                                <span className="text-zoru-ink">
                                    {fmtMoney(payout.amount, currency)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-zoru-ink-muted">
                                <span>Settled</span>
                                <span>{fmtMoney(totalSettled, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between text-zoru-ink-muted">
                                <span>TDS</span>
                                <span>{fmtMoney(payout.tdsDeducted, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-zoru-line pt-3 text-[14px] font-semibold text-zoru-ink">
                                <span>Advance</span>
                                <span>{fmtMoney(advance, currency)}</span>
                            </div>
                        </div>
                    </ZoruCard>

                    <LineageRail
                        current={{
                            kind: 'payout',
                            id,
                            no: payout.paymentNo,
                            status,
                        }}
                        lineage={(payout.lineage ?? []) as any}
                    />
                </div>
            </div>
        </div>
    );
}
