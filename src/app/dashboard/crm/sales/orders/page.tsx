'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ShoppingCart, LoaderCircle, Trash2 } from "lucide-react";
import Link from 'next/link';
import { deleteSalesOrder, getSalesOrders, updateSalesOrderStatus } from '@/app/actions/crm-sales-orders.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmSalesOrder } from '@/lib/definitions';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function SalesOrdersPage() {
    const [orders, setOrders] = useState<WithId<CrmSalesOrder>[]>([]);
    const [accountsMap, setAccountsMap] = useState<Map<string, string>>(new Map());
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [ordersData, accountsData] = await Promise.all([
                getSalesOrders(),
                getCrmAccounts()
            ]);
            setOrders(ordersData.orders);
            const newMap = new Map(accountsData.accounts.map(acc => [acc._id.toString(), acc.name]));
            setAccountsMap(newMap);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'ghost' => {
        const s = status.toLowerCase();
        if (s === 'delivered') return 'success';
        if (s === 'confirmed' || s === 'shipped') return 'warning';
        if (s === 'cancelled') return 'danger';
        return 'ghost';
    };

    const changeStatus = async (orderId: string, status: string) => {
        const res = await updateSalesOrderStatus(orderId, status);
        if (res.success) fetchData();
    };

    const removeOrder = async (orderId: string) => {
        const res = await deleteSalesOrder(orderId);
        if (res.success) fetchData();
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Sales Orders"
                subtitle="Create, share, and track sales orders."
                icon={ShoppingCart}
                actions={
                    <Link href="/dashboard/crm/sales/orders/new">
                        <ZoruButton>
                            <Plus className="h-4 w-4" strokeWidth={1.75} />
                            New Sales Order
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">Recent Sales Orders</h2>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Order #</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Amount</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={6} className="text-center h-24">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : orders.length > 0 ? (
                                orders.map(order => (
                                    <ZoruTableRow key={order._id.toString()} className="border-zoru-line cursor-pointer">
                                        <ZoruTableCell className="text-zoru-ink">{order.orderNumber}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{accountsMap.get(order.accountId.toString()) || 'Unknown Client'}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{new Date(order.orderDate).toLocaleDateString()}</ZoruTableCell>
                                        <ZoruTableCell>
                                            <div className="flex items-center gap-2">
                                                <ZoruBadge variant={getStatusVariant(order.status)}>{order.status}</ZoruBadge>
                                                <ZoruSelect
                                                    value={order.status}
                                                    onValueChange={(next) => changeStatus(order._id.toString(), next)}
                                                >
                                                    <ZoruSelectTrigger className="h-8 w-[132px]">
                                                        <ZoruSelectValue />
                                                    </ZoruSelectTrigger>
                                                    <ZoruSelectContent>
                                                        {['Draft', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map((status) => (
                                                            <ZoruSelectItem key={status} value={status}>{status}</ZoruSelectItem>
                                                        ))}
                                                    </ZoruSelectContent>
                                                </ZoruSelect>
                                            </div>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: order.currency || 'INR' }).format(order.total)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <ZoruButton
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeOrder(order._id.toString())}
                                                aria-label="Delete sales order"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                                            </ZoruButton>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={6} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                        No sales orders found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
