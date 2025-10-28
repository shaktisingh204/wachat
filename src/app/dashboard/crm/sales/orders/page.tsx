'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, ShoppingBag, LoaderCircle } from "lucide-react";
import Link from 'next/link';
import { getSalesOrders } from '@/app/actions/crm-sales-orders.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmSalesOrder, CrmAccount } from '@/lib/definitions';

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

    const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        const s = status.toLowerCase();
        if (s === 'delivered') return 'default';
        if (s === 'confirmed' || s === 'shipped') return 'secondary';
        if (s === 'cancelled') return 'destructive';
        return 'outline'; // Draft
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <ShoppingBag className="h-8 w-8" />
                        Sales Orders
                    </h1>
                    <p className="text-muted-foreground">Create, Share, and Track Sales Orders.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/crm/sales/orders/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Sales Order
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Sales Orders</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order #</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : orders.length > 0 ? (
                                    orders.map(order => (
                                        <TableRow key={order._id.toString()} className="cursor-pointer">
                                            <TableCell className="font-medium">{order.orderNumber}</TableCell>
                                            <TableCell>{accountsMap.get(order.accountId.toString()) || 'Unknown Client'}</TableCell>
                                            <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                                            <TableCell><Badge variant={getStatusVariant(order.status)}>{order.status}</Badge></TableCell>
                                            <TableCell className="text-right">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: order.currency || 'INR' }).format(order.total)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No sales orders found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
