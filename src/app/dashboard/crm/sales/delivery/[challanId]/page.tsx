/**
 * Delivery Challan detail page.
 *
 * Server component sibling of the quotation/invoice detail surfaces.
 * Renders the challan header (number, date, transport / vehicle / LR
 * info, status), the line-items table (qty, batch, expiry, serial nos)
 * and hosts <LineageRail> on the right so the document chain is
 * visible. Layout mirrors /dashboard/crm/sales/quotations/[quotationId]:
 * CrmPageHeader on top, 1fr_320px grid below.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Truck, FilePlus2, Pencil } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getDeliveryChallanById } from '@/app/actions/crm-delivery-challans.actions';
import { LineageRail } from '@/components/crm/lineage-rail';

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

const STATUS_VARIANT: Record<string, 'ghost' | 'success' | 'warning' | 'danger'> = {
    Draft: 'ghost',
    'In Transit': 'warning',
    Delivered: 'success',
    Returned: 'danger',
};

export default async function DeliveryChallanDetailPage({
    params,
}: {
    params: Promise<{ challanId: string }>;
}) {
    const { challanId } = await params;
    const dc = await getDeliveryChallanById(challanId);

    if (!dc) {
        notFound();
    }

    const id = (dc._id as any)?.toString?.() ?? String(dc._id);
    const lineItems = dc.lineItems ?? [];
    const transport = dc.transportDetails ?? {};
    const challanNo = dc.challanNumber || 'Delivery Challan';

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={challanNo}
                subtitle="Delivery challan detail"
                icon={Truck}
                actions={
                    <Link href="/dashboard/crm/sales/delivery">
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
                                <h2 className="text-[16px] text-zoru-ink">{challanNo}</h2>
                                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                                    Issued {fmtDate(dc.challanDate)}
                                    {dc.reason ? ` • ${dc.reason}` : ''}
                                </p>
                            </div>
                            <ZoruBadge variant={STATUS_VARIANT[dc.status] ?? 'ghost'}>
                                {dc.status}
                            </ZoruBadge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
                            <div>
                                <div className="text-zoru-ink-muted">Vehicle no.</div>
                                <div className="text-zoru-ink">{transport.vehicleNumber || '—'}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Transporter / Driver</div>
                                <div className="text-zoru-ink">{transport.driverName || '—'}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Mode of transport</div>
                                <div className="text-zoru-ink">{transport.mode || '—'}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">LR / consignment</div>
                                <div className="text-zoru-ink">
                                    {(dc as any)?.transportDetails?.lrNumber ||
                                        (dc as any)?.lrNumber ||
                                        '—'}
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <div className="text-zoru-ink-muted">Ship to</div>
                                <div className="text-zoru-ink">
                                    {(dc as any)?.shipTo?.name ||
                                        (dc as any)?.shippingAddress?.line1 ||
                                        (dc.accountId ? `Account ${String(dc.accountId)}` : '—')}
                                </div>
                                {((dc as any)?.shipTo?.city || (dc as any)?.shippingAddress?.city) && (
                                    <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                        {[
                                            (dc as any)?.shipTo?.city || (dc as any)?.shippingAddress?.city,
                                            (dc as any)?.shipTo?.state || (dc as any)?.shippingAddress?.state,
                                        ]
                                            .filter(Boolean)
                                            .join(', ')}
                                    </div>
                                )}
                            </div>
                        </div>

                        {lineItems.length > 0 && (
                            <div className="mt-6 overflow-x-auto rounded-lg border border-zoru-line">
                                <table className="w-full text-sm">
                                    <thead className="bg-zoru-surface-2">
                                        <tr className="border-b border-zoru-line">
                                            <th className="p-3 text-left text-zoru-ink">Item</th>
                                            <th className="p-3 text-right text-zoru-ink">Qty</th>
                                            <th className="p-3 text-left text-zoru-ink">Batch</th>
                                            <th className="p-3 text-left text-zoru-ink">Expiry</th>
                                            <th className="p-3 text-left text-zoru-ink">Serial nos.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lineItems.map((li) => {
                                            const anyLi = li as any;
                                            const serials: string[] = Array.isArray(anyLi?.serialNumbers)
                                                ? anyLi.serialNumbers
                                                : Array.isArray(anyLi?.serialNos)
                                                    ? anyLi.serialNos
                                                    : [];
                                            return (
                                                <tr
                                                    key={li.id}
                                                    className="border-b border-zoru-line last:border-b-0 align-top"
                                                >
                                                    <td className="p-3 text-zoru-ink">
                                                        <div>{li.name || '—'}</div>
                                                        {li.hsnCode && (
                                                            <div className="text-[11.5px] text-zoru-ink-muted">
                                                                HSN {li.hsnCode}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right text-zoru-ink">
                                                        {li.quantity}
                                                        {li.unit ? ` ${li.unit}` : ''}
                                                    </td>
                                                    <td className="p-3 text-zoru-ink">{anyLi?.batch || '—'}</td>
                                                    <td className="p-3 text-zoru-ink">
                                                        {anyLi?.expiry ? fmtDate(anyLi.expiry) : '—'}
                                                    </td>
                                                    <td className="p-3 text-zoru-ink">
                                                        {serials.length ? serials.join(', ') : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {dc.notes && (
                            <div className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
                                <div className="text-[11.5px] text-zoru-ink-muted">Notes</div>
                                <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                                    {dc.notes}
                                </div>
                            </div>
                        )}

                        <div className="mt-6 flex flex-wrap items-center gap-2">
                            {/*
                              Edit subroute does not exist for delivery challans yet
                              (only /new is present). Button is hidden here; if/when
                              an [challanId]/edit route lands, swap this for a real
                              <Link>.
                            */}
                            {false && (
                                <Link href={`/dashboard/crm/sales/delivery/${id}/edit`}>
                                    <ZoruButton variant="outline">
                                        <Pencil className="h-4 w-4" />
                                        Edit
                                    </ZoruButton>
                                </Link>
                            )}
                            <Link
                                href={`/dashboard/crm/sales/invoices/new?fromKind=deliveryChallan&fromId=${id}`}
                            >
                                <ZoruButton variant="default">
                                    <FilePlus2 className="h-4 w-4" />
                                    Generate Invoice
                                </ZoruButton>
                            </Link>
                        </div>
                    </ZoruCard>
                </div>

                <div className="flex flex-col gap-6">
                    <LineageRail
                        current={{
                            kind: 'deliveryChallan',
                            id,
                            no: dc.challanNumber,
                            status: dc.status,
                        }}
                        lineage={dc.lineage ?? []}
                    />
                </div>
            </div>
        </div>
    );
}
