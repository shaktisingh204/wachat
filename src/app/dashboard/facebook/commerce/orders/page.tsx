
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getFacebookOrders } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Package, Eye, RefreshCw, LoaderCircle } from 'lucide-react';
import type { FacebookOrder } from '@/lib/definitions';
import { format } from 'date-fns';

function OrdersPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96 mt-2" /></div>
            <Card>
                <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                <CardContent><Skeleton className="h-64 w-full" /></CardContent>
            </Card>
        </div>
    );
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<FacebookOrder[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();

    const fetchData = () => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startLoading(async () => {
                const result = await getFacebookOrders(storedProjectId);
                if (result.error) {
                    setError(result.error);
                } else if (result.orders) {
                    setOrders(result.orders);
                }
            });
        } else {
            setError("No active project selected.");
        }
    };
    
    useEffect(() => {
        fetchData();
    }, []);

    const getStatusVariant = (status?: string) => {
        if (!status) return 'outline';
        const s = status.toLowerCase();
        if (s === 'completed' || s === 'fulfilled') return 'default';
        if (s.includes('pending') || s === 'created') return 'secondary';
        if (s === 'cancelled') return 'destructive';
        return 'outline';
    }

    if (isLoading && orders.length === 0) {
        return <OrdersPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Package /> Order Management</h1>
                    <p className="text-muted-foreground">View and manage orders from your Facebook Shop.</p>
                </div>
                <Button onClick={fetchData} variant="outline" disabled={isLoading}>
                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                    Refresh
                </Button>
            </div>

            {error ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not fetch orders</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Orders</CardTitle>
                        <CardDescription>This feature is only available for shops using Facebook or Instagram Checkout.</CardDescription>
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
                                            <TableRow key={order.id}>
                                                <TableCell className="font-mono text-xs">{order.id}</TableCell>
                                                <TableCell>{format(new Date(order.created), 'PPp')}</TableCell>
                                                <TableCell>{order.buyer_details?.name || 'N/A'}</TableCell>
                                                <TableCell><Badge variant={getStatusVariant(order.order_status?.state)} className="capitalize">{order.order_status?.state?.replace('_', ' ').toLowerCase()}</Badge></TableCell>
                                                <TableCell>{order.estimated_payment_details?.total_amount.formatted_amount || 'N/A'}</TableCell>
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
            )}
        </div>
    );
}
