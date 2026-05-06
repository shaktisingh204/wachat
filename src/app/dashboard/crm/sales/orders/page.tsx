'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ShoppingCart, LoaderCircle } from "lucide-react";
import Link from 'next/link';
import { getSalesOrders } from '@/app/actions/crm-sales-orders.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmSalesOrder } from '@/lib/definitions';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
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
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={5} className="text-center h-24">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : orders.length > 0 ? (
                                orders.map(order => (
                                    <ZoruTableRow key={order._id.toString()} className="border-zoru-line cursor-pointer">
                                        <ZoruTableCell className="text-zoru-ink">{order.orderNumber}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{accountsMap.get(order.accountId.toString()) || 'Unknown Client'}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{new Date(order.orderDate).toLocaleDateString()}</ZoruTableCell>
                                        <ZoruTableCell><ZoruBadge variant={getStatusVariant(order.status)}>{order.status}</ZoruBadge></ZoruTableCell>
                                        <ZoruTableCell className="text-right text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: order.currency || 'INR' }).format(order.total)}</ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={5} className="h-24 text-center text-[13px] text-zoru-ink-muted">
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
