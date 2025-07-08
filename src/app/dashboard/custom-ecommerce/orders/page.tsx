
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Package, Eye, RefreshCw, LoaderCircle } from 'lucide-react';
import { getEcommShops, getEcommOrders } from '@/app/actions/custom-ecommerce.actions';
import type { WithId, EcommShop, EcommOrder } from '@/lib/definitions';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function PageSkeleton() {
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
    const [shops, setShops] = useState<WithId<EcommShop>[]>([]);
    const [selectedShopId, setSelectedShopId] = useState<string>('');
    const [orders, setOrders] = useState<WithId<EcommOrder>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            setProjectId(storedProjectId);
            startLoading(async () => {
                const shopsData = await getEcommShops(storedProjectId);
                setShops(shopsData);
                if (shopsData.length > 0) {
                    const shopIdToLoad = selectedShopId || shopsData[0]._id.toString();
                    setSelectedShopId(shopIdToLoad);
                    const ordersData = await getEcommOrders(shopIdToLoad);
                    setOrders(ordersData);
                }
            });
        }
    }, [projectId, selectedShopId]);


    const handleShopChange = async (shopId: string) => {
        setSelectedShopId(shopId);
        startLoading(async () => {
            const ordersData = await getEcommOrders(shopId);
            setOrders(ordersData);
        });
    }

    const getStatusVariant = (status?: string) => {
        if (!status) return 'outline';
        const s = status.toLowerCase();
        if (s === 'paid' || s === 'shipped' || s === 'delivered') return 'default';
        if (s === 'pending') return 'secondary';
        if (s === 'cancelled') return 'destructive';
        return 'outline';
    };

    if (isLoading && orders.length === 0) {
        return <PageSkeleton />;
    }

    if (!projectId) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage its orders.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Package /> Orders</h1>
                    <p className="text-muted-foreground">View and manage orders from your custom shop.</p>
                </div>
                 <Button onClick={() => handleShopChange(selectedShopId)} variant="outline" disabled={isLoading}>
                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                    Refresh
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <CardTitle>Recent Orders</CardTitle>
                            <CardDescription>Orders from your selected shop.</CardDescription>
                        </div>
                         <Select value={selectedShopId} onValueChange={handleShopChange} disabled={shops.length === 0}>
                            <SelectTrigger className="w-full sm:w-auto sm:min-w-[200px]">
                                <SelectValue placeholder="Select a shop..." />
                            </SelectTrigger>
                            <SelectContent>
                                {shops.map((shop) => (
                                    <SelectItem key={shop._id.toString()} value={shop._id.toString()}>
                                        {shop.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
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
                                            <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: shops.find(s=> s._id.toString() === selectedShopId)?.currency || 'USD' }).format(order.total)}</TableCell>
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

    