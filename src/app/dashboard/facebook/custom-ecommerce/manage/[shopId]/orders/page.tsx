
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Package, Eye, RefreshCw, LoaderCircle } from 'lucide-react';
import { getEcommOrders, getEcommShopById } from '@/app/actions/custom-ecommerce.actions';
import type { WithId, EcommOrder, EcommShop } from '@/lib/definitions';
import { format } from 'date-fns';

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Card>
                <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                <CardContent><Skeleton className="h-64 w-full" /></CardContent>
            </Card>
        </div>
    );
}

export default function OrdersPage() {
    const params = useParams();
    const shopId = params.shopId as string;
    const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
    const [orders, setOrders] = useState<WithId<EcommOrder>[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchData = () => {
        if (shopId) {
            startLoading(async () => {
                const [shopData, ordersData] = await Promise.all([
                    getEcommShopById(shopId),
                    getEcommOrders(shopId),
                ]);
                setShop(shopData);
                setOrders(ordersData);
            });
        }
    };

    useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopId]);

    const getStatusVariant = (status?: string) => {
        if (!status) return 'outline';
        const s = status.toLowerCase();
        if (s === 'paid' || s === 'shipped' || s === 'delivered') return 'default';
        if (s === 'pending') return 'secondary';
        if (s === 'cancelled') return 'destructive';
        return 'outline';
    };

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!shop) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Shop Not Found</AlertTitle>
                <AlertDescription>Please select a valid shop to manage its orders.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Orders</h2>
                    <p className="text-muted-foreground">View and manage orders from your custom shop.</p>
                </div>
                 <Button onClick={fetchData} variant="outline" disabled={isLoading}>
                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                    Refresh
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                     <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order ID</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.length > 0 ? (
                                    orders.map(order => (
                                        <TableRow key={order._id.toString()}>
                                            <TableCell className="font-mono text-xs">{order._id.toString().slice(-8)}</TableCell>
                                            <TableCell>{format(new Date(order.createdAt), 'PPp')}</TableCell>
                                            <TableCell>{order.customerInfo?.name || 'N/A'}</TableCell>
                                            <TableCell><Badge variant={getStatusVariant(order.status)} className="capitalize">{order.status}</Badge></TableCell>
                                            <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: shop.currency || 'USD' }).format(order.total)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">No orders found.</TableCell>
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
