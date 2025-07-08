
import { getEcommOrderById } from '@/app/actions/custom-ecommerce.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Package } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OrderDetailsPage({ params }: { params: { slug: string, orderId: string } }) {
    // In a real app, you'd also check if this order belongs to the logged-in customer.
    const order = await getEcommOrderById(params.orderId);

    if (!order) {
        notFound();
    }

    return (
        <div className="space-y-4">
             <Button asChild variant="ghost" className="-ml-4">
                <Link href={`/shop/${params.slug}/account/orders`}>
                    &larr; Back to Order History
                </Link>
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Order Details</CardTitle>
                    <CardDescription>
                        Order #{order._id.toString()} - Placed on {new Date(order.createdAt).toLocaleDateString()}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                             <h3 className="font-semibold">Shipping Address</h3>
                             <address className="not-italic text-muted-foreground">
                                {order.customerInfo.name}<br />
                                {order.shippingAddress.street}<br />
                                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}<br />
                                {order.shippingAddress.country}
                             </address>
                        </div>
                         <div className="space-y-2">
                             <h3 className="font-semibold">Customer Information</h3>
                            <p className="text-muted-foreground">
                                {order.customerInfo.name}<br/>
                                {order.customerInfo.email}<br/>
                                {order.customerInfo.phone}
                            </p>
                        </div>
                    </div>
                     <Separator />
                    <div>
                        <h3 className="font-semibold text-lg mb-2">Order Items</h3>
                        <ul className="space-y-3">
                            {order.items.map(item => (
                                <li key={item.productId} className="flex justify-between items-center text-sm">
                                    <span>{item.productName} &times; {item.quantity}</span>
                                    <span className="font-medium">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.price * item.quantity)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                     <Separator />
                     <div className="space-y-2">
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.subtotal)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.shipping)}</span></div>
                        <div className="flex justify-between font-bold text-lg"><span className="text-foreground">Total</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.total)}</span></div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
