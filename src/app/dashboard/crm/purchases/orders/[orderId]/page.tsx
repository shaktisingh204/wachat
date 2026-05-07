'use client';

/**
 * Purchase Order detail page (lineage rail host).
 *
 * Mirrors the invoice detail PoC: minimal detail surface whose primary
 * job is to host <LineageRail> on a real purchase document, plus quick
 * cross-feature actions (Edit, Create GRN, Create Bill).
 */

import { use, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText, LoaderCircle, ShoppingCart } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruSkeleton,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getPurchaseOrderById } from '@/app/actions/crm-purchase-orders.actions';
import { getCrmVendorById } from '@/app/actions/crm-vendors.actions';
import type { WithId, CrmPurchaseOrder, CrmVendor } from '@/lib/definitions';
import { LineageRail } from '@/components/crm/lineage-rail';

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(n: number, currency = 'INR'): string {
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(n || 0);
    } catch {
        return `${currency} ${n || 0}`;
    }
}

const STATUS_VARIANT: Record<string, 'ghost' | 'success' | 'warning' | 'danger'> = {
    Draft: 'ghost',
    Sent: 'warning',
    Received: 'success',
    Cancelled: 'ghost',
};

export default function PurchaseOrderDetailPage(props: {
    params: Promise<{ orderId: string }>;
}) {
    const { orderId } = use(props.params);
    const [po, setPo] = useState<WithId<CrmPurchaseOrder> | null>(null);
    const [vendor, setVendor] = useState<WithId<CrmVendor> | null>(null);
    const [notFoundFlag, setNotFoundFlag] = useState(false);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const result = await getPurchaseOrderById(orderId);
            if (!result) {
                setNotFoundFlag(true);
                return;
            }
            setPo(result);
            const vendorIdStr = result.vendorId?.toString?.() ?? String(result.vendorId ?? '');
            if (vendorIdStr) {
                const vendorResult = await getCrmVendorById(vendorIdStr);
                setVendor(vendorResult ?? null);
            }
        });
    }, [orderId]);

    useEffect(() => {
        if (notFoundFlag) notFound();
    }, [notFoundFlag]);

    if (isLoading && !po) {
        return (
            <div className="flex w-full flex-col gap-6">
                <ZoruSkeleton className="h-12 w-full" />
                <ZoruSkeleton className="h-48 w-full" />
            </div>
        );
    }

    if (!po) {
        return (
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="Purchase order not found"
                    subtitle="The purchase order you're looking for doesn't exist or you don't have access."
                    icon={ShoppingCart}
                />
                <Link href="/dashboard/crm/purchases/orders">
                    <ZoruButton variant="outline">
                        <ArrowLeft className="h-4 w-4" />
                        Back to purchase orders
                    </ZoruButton>
                </Link>
            </div>
        );
    }

    const id = (po._id as any)?.toString?.() ?? String(po._id);
    const lineItems = po.lineItems ?? [];
    const vendorLabel = vendor?.displayName ?? vendor?.name ?? `Vendor ${po.vendorId.toString().slice(-6)}`;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={po.orderNumber || 'Purchase Order'}
                subtitle="Purchase order detail"
                icon={ShoppingCart}
                actions={
                    <Link href="/dashboard/crm/purchases/orders">
                        <ZoruButton variant="outline">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </ZoruButton>
                    </Link>
                }
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-6">
                    <ZoruCard className="p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-[16px] text-zoru-ink">{po.orderNumber}</h2>
                                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                                    Ordered {fmtDate(po.orderDate)}
                                    {po.expectedDeliveryDate ? ` • Expected ${fmtDate(po.expectedDeliveryDate)}` : ''}
                                </p>
                                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">{vendorLabel}</p>
                                {vendor?.gstin && (
                                    <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">GSTIN: {vendor.gstin}</p>
                                )}
                            </div>
                            <ZoruBadge variant={STATUS_VARIANT[po.status] ?? 'ghost'}>
                                {po.status}
                            </ZoruBadge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                            <div>
                                <div className="text-zoru-ink-muted">Vendor</div>
                                <div className="text-zoru-ink">{vendorLabel}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Total</div>
                                <div className="text-zoru-ink">{fmtMoney(po.total, po.currency)}</div>
                            </div>
                        </div>

                        {lineItems.length > 0 && (
                            <div className="mt-6 overflow-x-auto rounded-lg border border-zoru-line">
                                <table className="w-full text-sm">
                                    <thead className="bg-zoru-surface-2">
                                        <tr className="border-b border-zoru-line">
                                            <th className="p-3 text-left text-zoru-ink">Item</th>
                                            <th className="p-3 text-right text-zoru-ink">Qty</th>
                                            <th className="p-3 text-right text-zoru-ink">Rate</th>
                                            <th className="p-3 text-right text-zoru-ink">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lineItems.map((li, idx) => (
                                            <tr key={idx} className="border-b border-zoru-line last:border-b-0">
                                                <td className="p-3 text-zoru-ink">
                                                    <div>{li.description || '—'}</div>
                                                </td>
                                                <td className="p-3 text-right text-zoru-ink">{li.quantity}</td>
                                                <td className="p-3 text-right text-zoru-ink">{fmtMoney(li.rate, po.currency)}</td>
                                                <td className="p-3 text-right text-zoru-ink">
                                                    {fmtMoney(li.amount ?? (li.quantity || 0) * (li.rate || 0), po.currency)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </ZoruCard>

                    <ZoruCard className="p-6">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-zoru-ink-muted" />
                            <h3 className="text-[14px] text-zoru-ink">Approval workflow</h3>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                            <div>
                                <div className="text-zoru-ink-muted">Status</div>
                                <div className="mt-1">
                                    <ZoruBadge variant={STATUS_VARIANT[po.status] ?? 'ghost'}>
                                        {po.status}
                                    </ZoruBadge>
                                </div>
                            </div>
                            {po.paymentTerms && (
                                <div>
                                    <div className="text-zoru-ink-muted">Payment terms</div>
                                    <div className="text-zoru-ink">{po.paymentTerms}</div>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
                            <div className="text-[11.5px] text-zoru-ink-muted">Notes</div>
                            <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                                {po.notes || '—'}
                            </div>
                        </div>
                    </ZoruCard>

                    <ZoruCard className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/dashboard/crm/purchases/orders/${id}/edit`}>
                                <ZoruButton variant="outline">Edit</ZoruButton>
                            </Link>
                            <Link href={`/dashboard/crm/inventory/grn/new?fromKind=purchaseOrder&fromId=${id}`}>
                                <ZoruButton variant="outline">+ Create GRN</ZoruButton>
                            </Link>
                            <Link href={`/dashboard/crm/expenses/new?fromKind=purchaseOrder&fromId=${id}`}>
                                <ZoruButton variant="outline">+ Create Bill</ZoruButton>
                            </Link>
                        </div>
                    </ZoruCard>
                </div>

                <div className="flex flex-col gap-6">
                    <LineageRail
                        current={{
                            kind: 'purchaseOrder',
                            id,
                            no: po.orderNumber,
                            status: po.status,
                        }}
                        lineage={po.lineage ?? []}
                    />
                </div>
            </div>

            {isLoading && (
                <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-md border border-zoru-line bg-zoru-surface px-3 py-2 text-[12.5px] text-zoru-ink-muted">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Refreshing
                </div>
            )}
        </div>
    );
}
