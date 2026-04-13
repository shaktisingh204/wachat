'use server';

import { getPurchaseOrders } from '@/app/actions/crm-purchase-orders.actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

import { ClayCard, ClayBadge } from '@/components/clay';
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
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-clay-obsidian px-4 text-[13px] font-medium text-white hover:bg-clay-obsidian-hover"
                    >
                        <Plus className="h-4 w-4" strokeWidth={1.75} />
                        New Purchase Order
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] font-semibold text-clay-ink">All Orders</h2>
                        <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Showing {orders.length} of {total} orders</p>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-ink-muted" />
                        <Input
                            type="search"
                            placeholder="Search orders..."
                            className="h-10 rounded-clay-md border-clay-border bg-clay-surface pl-9 text-[13px]"
                            defaultValue={query}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Order #</TableHead>
                                <TableHead className="text-clay-ink-muted">Date</TableHead>
                                <TableHead className="text-clay-ink-muted">Vendor</TableHead>
                                <TableHead className="text-clay-ink-muted">Status</TableHead>
                                <TableHead className="text-clay-ink-muted">Exp. Delivery</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Amount</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.length === 0 ? (
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No orders found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                orders.map((order) => (
                                    <TableRow key={order._id.toString()} className="border-clay-border">
                                        <TableCell className="font-medium text-clay-ink">{order.orderNumber}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{format(new Date(order.orderDate), 'PP')}</TableCell>
                                        <TableCell>
                                            <span className="text-[12.5px] italic text-clay-ink-muted">Vendor {order.vendorId.toString().slice(-4)}</span>
                                        </TableCell>
                                        <TableCell>
                                            <ClayBadge tone={order.status === 'Sent' ? 'green' : 'rose-soft'}>
                                                {order.status}
                                            </ClayBadge>
                                        </TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">
                                            {order.expectedDeliveryDate ? format(new Date(order.expectedDeliveryDate), 'PP') : '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-[13px] text-clay-ink">
                                            {order.currency} {order.total.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Link
                                                href={`/dashboard/crm/purchases/orders/${order._id}`}
                                                className="text-[12.5px] font-medium text-clay-ink hover:underline"
                                            >
                                                View
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
