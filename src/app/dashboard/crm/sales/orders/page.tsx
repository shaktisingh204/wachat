'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ShoppingCart, LoaderCircle } from "lucide-react";
import Link from 'next/link';
import { getSalesOrders } from '@/app/actions/crm-sales-orders.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmSalesOrder } from '@/lib/definitions';

import { ClayButton, ClayCard, ClayBadge } from '@/components/clay';
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

    const getStatusTone = (status: string): 'green' | 'amber' | 'red' | 'rose-soft' => {
        const s = status.toLowerCase();
        if (s === 'delivered') return 'green';
        if (s === 'confirmed' || s === 'shipped') return 'amber';
        if (s === 'cancelled') return 'red';
        return 'rose-soft';
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Sales Orders"
                subtitle="Create, share, and track sales orders."
                icon={ShoppingCart}
                actions={
                    <Link href="/dashboard/crm/sales/orders/new">
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            New Sales Order
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Recent Sales Orders</h2>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Order #</TableHead>
                                <TableHead className="text-muted-foreground">Client</TableHead>
                                <TableHead className="text-muted-foreground">Date</TableHead>
                                <TableHead className="text-muted-foreground">Status</TableHead>
                                <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-border">
                                    <TableCell colSpan={5} className="text-center h-24">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : orders.length > 0 ? (
                                orders.map(order => (
                                    <TableRow key={order._id.toString()} className="border-border cursor-pointer">
                                        <TableCell className="font-medium text-foreground">{order.orderNumber}</TableCell>
                                        <TableCell className="text-foreground">{accountsMap.get(order.accountId.toString()) || 'Unknown Client'}</TableCell>
                                        <TableCell className="text-foreground">{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                                        <TableCell><ClayBadge tone={getStatusTone(order.status)} dot>{order.status}</ClayBadge></TableCell>
                                        <TableCell className="text-right font-medium text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: order.currency || 'INR' }).format(order.total)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-border">
                                    <TableCell colSpan={5} className="h-24 text-center text-[13px] text-muted-foreground">
                                        No sales orders found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
