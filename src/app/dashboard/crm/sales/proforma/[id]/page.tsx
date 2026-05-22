import { Button, Card } from '@/components/zoruui';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Proforma invoice detail — `/dashboard/crm/sales/proforma/[id]`.
 *
 * Server component: fetches via `getProformaInvoiceById`, renders the
 * `<EntityDetailShell>` with header (status pill + Edit), a Card
 * body, and an Activity footer for `entityKind: 'proforma'`.
 */

import Link from 'next/link';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getProformaInvoiceById } from '@/app/actions/crm-proforma-invoices.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string | number | Date);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

function fmtMoney(n: unknown, currency = 'INR'): string {
    const num = typeof n === 'number' ? n : parseFloat(String(n ?? ''));
    if (isNaN(num)) return '—';
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(num);
    } catch {
        return `${currency} ${num}`;
    }
}

const STATUS_TONE: Record<string, EntityStatusTone> = {
    Draft: 'neutral',
    Sent: 'amber',
    Accepted: 'green',
    Rejected: 'red',
    Expired: 'red',
    Converted: 'blue',
};

function Field({
    label,
    children,
    fullWidth,
}: {
    label: string;
    children: React.ReactNode;
    fullWidth?: boolean;
}) {
    return (
        <div className={fullWidth ? 'sm:col-span-2' : undefined}>
            <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                {label}
            </div>
            <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
        </div>
    );
}

export default async function ProformaDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const proforma = await getProformaInvoiceById(id);
    if (!proforma) notFound();

    const proformaNumber = (proforma as any).proformaNumber || `Proforma ${id.slice(-6)}`;
    const status = ((proforma as any).status as string) || 'Draft';
    const currency = ((proforma as any).currency as string) || 'INR';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const lineItems = Array.isArray((proforma as any).lineItems)
        ? ((proforma as any).lineItems as any[])
        : [];

    return (
        <EntityDetailShell
            title={proformaNumber}
            eyebrow="PROFORMA INVOICE"
            status={{ label: status, tone }}
            back={{ href: '/dashboard/crm/sales/proforma', label: 'Back to proforma' }}
            actions={
                <Button asChild>
                    <Link href={`/dashboard/crm/sales/proforma/${id}/edit`}>
                        <Pencil className="h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
            audit={<EntityAuditTimeline entityKind="proforma" entityId={id} />}
        >
            <Card className="p-6">
                <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Proforma details
                </h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field label="Proforma number">{proformaNumber}</Field>
                    <Field label="Status">{status}</Field>
                    <Field label="Proforma date">
                        {fmtDate((proforma as any).proformaDate)}
                    </Field>
                    <Field label="Valid until">
                        {fmtDate((proforma as any).validTillDate)}
                    </Field>
                    <Field label="Currency">{currency}</Field>
                    <Field label="Subtotal">
                        {fmtMoney((proforma as any).subtotal, currency)}
                    </Field>
                    <Field label="Total">
                        {fmtMoney((proforma as any).total, currency)}
                    </Field>
                    {(proforma as any).notes ? (
                        <Field label="Notes" fullWidth>
                            <p className="whitespace-pre-wrap">
                                {String((proforma as any).notes)}
                            </p>
                        </Field>
                    ) : null}
                </div>

                {lineItems.length > 0 ? (
                    <div className="mt-6">
                        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Line items
                        </h3>
                        <div className="overflow-x-auto rounded-md border border-zoru-line">
                            <table className="w-full text-[13px]">
                                <thead className="bg-zoru-surface-2">
                                    <tr className="border-b border-zoru-line text-left">
                                        <th className="p-2 font-medium text-zoru-ink">Item</th>
                                        <th className="p-2 text-right font-medium text-zoru-ink">
                                            Qty
                                        </th>
                                        <th className="p-2 text-right font-medium text-zoru-ink">
                                            Rate
                                        </th>
                                        <th className="p-2 text-right font-medium text-zoru-ink">
                                            Amount
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((li, idx) => (
                                        <tr
                                            key={idx}
                                            className="border-b border-zoru-line last:border-b-0"
                                        >
                                            <td className="p-2 align-top text-zoru-ink">
                                                {li.name || li.description || '—'}
                                            </td>
                                            <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                                                {li.quantity}
                                            </td>
                                            <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                                                {fmtMoney(li.rate, currency)}
                                            </td>
                                            <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                                                {fmtMoney(
                                                    Number(li.quantity || 0) * Number(li.rate || 0),
                                                    currency,
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : null}
            </Card>
        </EntityDetailShell>
    );
}
