
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Package, Eye, RefreshCw, LoaderCircle } from 'lucide-react';
import { getProjectById } from '@/app/actions';
import { getEcommOrders } from '@/app/actions/custom-ecommerce.actions';
import type { WithId, Project, EcommOrder } from '@/lib/definitions';
import { format } from 'date-fns';

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
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [orders, setOrders] = useState<WithId<EcommOrder>[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchData = () => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startLoading(async () => {
                const projectData = await getProjectById(storedProjectId);
                setProject(projectData);
                if (projectData) {
                    const ordersData = await getEcommOrders(storedProjectId);
                    setOrders(ordersData);
                }
            });
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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

    if (!project) {
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
                                            <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: project.ecommSettings?.currency || 'USD' }).format(order.total)}</TableCell>
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
