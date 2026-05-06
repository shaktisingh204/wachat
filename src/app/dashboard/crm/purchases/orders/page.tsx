import { ZoruBadge, ZoruCard, ZoruInput, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import { getPurchaseOrders } from '@/app/actions/crm-purchase-orders.actions';

import { Plus, Search, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

import { format } from 'date-fns';

import { CrmPageHeader } from '../../_components/crm-page-header';

export default async function PurchaseOrdersPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string;
        page?: string;
    }>;
}) {
    const params = await searchParams;
    const query = params?.query || '';
    const currentPage = Number(params?.page) || 1;
    const { orders, total } = await getPurchaseOrders(currentPage, 20, query as any);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Purchase Orders"
                subtitle="Manage your purchase orders and track vendor deliveries."
                icon={ShoppingBag}
                actions={
                    <Link
                        href="/dashboard/crm/purchases/orders/new"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-[13px] font-medium text-white hover:bg-foreground/90"
                    >
                        <Plus className="h-4 w-4" strokeWidth={1.75} />
                        New Purchase Order
                    </Link>
                }
            />

            <ZoruCard>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] font-semibold text-foreground">All Orders</h2>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">Showing {orders.length} of {total} orders</p>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <ZoruInput
                            type="search"
                            placeholder="Search orders..."
                            className="h-10 rounded-lg border-border bg-card pl-9 text-[13px]"
                            defaultValue={query}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Order #</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Vendor</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Exp. Delivery</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Amount</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {orders.length === 0 ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={7} className="h-24 text-center text-[13px] text-muted-foreground">
                                        No orders found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                orders.map((order) => (
                                    <ZoruTableRow key={order._id.toString()} className="border-border">
                                        <ZoruTableCell className="font-medium text-foreground">{order.orderNumber}</ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">{format(new Date(order.orderDate), 'PP')}</ZoruTableCell>
                                        <ZoruTableCell>
                                            <span className="text-[12.5px] italic text-muted-foreground">Vendor {order.vendorId.toString().slice(-4)}</span>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruBadge variant={(order.status === 'Sent' ? 'green' : 'rose-soft') as any}>
                                                {order.status}
                                            </ZoruBadge>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">
                                            {order.expectedDeliveryDate ? format(new Date(order.expectedDeliveryDate), 'PP') : '-'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-foreground">
                                            {order.currency} {order.total.toFixed(2)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <Link
                                                href={`/dashboard/crm/purchases/orders/${order._id}`}
                                                className="text-[12.5px] font-medium text-foreground hover:underline"
                                            >
                                                View
                                            </Link>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
