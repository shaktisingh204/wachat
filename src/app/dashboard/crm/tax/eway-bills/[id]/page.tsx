import { ZoruBadge, ZoruButton, ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { ArrowLeft,
  Truck } from 'lucide-react';

/**
 * E-way bill detail — `/dashboard/crm/tax/eway-bills/[id]`.
 *
 * Server component. Surfaces the persisted bill + history. The
 * <EWayBillRowActions> client widget is reused for the mutating ops.
 */

import Link from 'next/link';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getEWayBill } from '@/app/actions/crm-india-eway.actions';
import { EWayBillRowActions } from '../_components/row-actions';

export const dynamic = 'force-dynamic';

function statusVariant(s: string): 'success' | 'danger' | 'warning' {
    if (s === 'cancelled') return 'danger';
    if (s === 'expired') return 'warning';
    return 'success';
}

export default async function EWayBillDetailPage(props: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await props.params;
    if (!id) notFound();

    const bill: any = await getEWayBill(id);
    if (!bill) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`E-way bill · ${bill.ewbNo}`}
                subtitle={`Generated via ${bill.provider}`}
                icon={Truck}
                actions={
                    <ZoruButton asChild variant="outline">
                        <Link href="/dashboard/crm/tax/eway-bills">
                            <ArrowLeft className="h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <ZoruCard>
                <ZoruCardHeader className="flex flex-row items-center justify-between gap-3">
                    <ZoruCardTitle>Overview</ZoruCardTitle>
                    <ZoruBadge variant={statusVariant(bill.status)}>{bill.status}</ZoruBadge>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
                        <Field label="EWB No" value={bill.ewbNo} mono />
                        <Field label="EWB Date" value={String(bill.ewbDate ?? '')} />
                        <Field label="Valid till" value={String(bill.validUpto ?? '')} />
                        <Field label="From GSTIN" value={bill.fromGstin} mono />
                        <Field label="To GSTIN" value={bill.toGstin ?? 'URP'} mono />
                        <Field label="From → To pincode" value={`${bill.fromPincode} → ${bill.toPincode}`} />
                        <Field label="Distance (km)" value={String(bill.distanceKm ?? '')} />
                        <Field label="Total value" value={`₹${bill.totalValue}`} />
                        <Field label="Vehicle" value={bill.vehicleNumber ?? '—'} mono />
                        <Field label="Transporter" value={bill.transporterId ?? '—'} mono />
                        {bill.cancelReason ? (
                            <Field label="Cancel reason" value={bill.cancelReason} />
                        ) : null}
                        {bill.linkedInvoiceId ? (
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Linked invoice
                                </span>
                                <Link
                                    href={`/dashboard/crm/sales/invoices/${bill.linkedInvoiceId}`}
                                    className="text-[13px] text-primary underline"
                                >
                                    {String(bill.linkedInvoiceId)}
                                </Link>
                            </div>
                        ) : null}
                    </dl>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Actions</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <EWayBillRowActions id={id} status={bill.status} />
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>History</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    {Array.isArray(bill.history) && bill.history.length > 0 ? (
                        <ol className="flex flex-col gap-2 text-[12px]">
                            {bill.history.map((h: any, i: number) => (
                                <li
                                    key={i}
                                    className="rounded-md border border-border bg-muted/30 p-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">{h.kind}</span>
                                        <span className="text-muted-foreground">{String(h.at)}</span>
                                    </div>
                                    {h.reason ? (
                                        <p className="mt-1 text-muted-foreground">{h.reason}</p>
                                    ) : null}
                                    {h.details ? (
                                        <pre className="mt-1 whitespace-pre-wrap text-[10px] text-muted-foreground">
                                            {JSON.stringify(h.details, null, 2)}
                                        </pre>
                                    ) : null}
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="text-[13px] text-muted-foreground">No history.</p>
                    )}
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
            </span>
            <span className={mono ? 'font-mono text-[12px] break-all' : 'text-[13px]'}>
                {value}
            </span>
        </div>
    );
}
