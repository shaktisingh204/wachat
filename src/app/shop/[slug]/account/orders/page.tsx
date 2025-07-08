
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getEcommOrdersForCustomer } from '@/app/actions/custom-ecommerce.actions';
import { Eye } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OrderHistoryPage({ params }: { params: { slug: string }}) {
    // This uses mock data. In a real app, you'd get the customer ID from the session.
    const orders = await getEcommOrdersForCustomer('mock-customer-id');

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">Order History</h1>
             <Card>
                <CardContent className="p-0">
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.length > 0 ? (
                                orders.map(order => (
                                    <TableRow key={order._id.toString()}>
                                        <TableCell className="font-mono">#{order._id.toString().slice(-6)}</TableCell>
                                        <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell><Badge>{order.status}</Badge></TableCell>
                                        <TableCell>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.total)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild variant="outline" size="sm">
                                                <Link href={`/shop/${params.slug}/account/orders/${order._id.toString()}`}>
                                                    <Eye className="mr-2 h-4 w-4" /> View
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">You haven't placed any orders yet.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
