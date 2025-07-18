
'use client';

import { getEcommOrderById } from '@/app/actions/custom-ecommerce.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { WithId, EcommOrder } from '@/lib/definitions';
import { CheckCircle, Package } from 'lucide-react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OrderConfirmationPage({ params }: { params: { orderId: string, slug: string } }) {
    const [order, setOrder] = useState<WithId<EcommOrder> | null>(null);

    useEffect(() => {
        getEcommOrderById(params.orderId).then(setOrder);
    }, [params.orderId]);


    if (!order) {
        return  <div className="flex items-center justify-center min-h-[50vh]">Loading...</div>; // Or a skeleton loader
    }
    

    return (
         <div className="container mx-auto px-4 py-12 flex justify-center">
             <Card className="w-full max-w-2xl text-center">
                <CardHeader>
                    <div className="mx-auto bg-green-100 text-green-700 rounded-full h-16 w-16 flex items-center justify-center mb-4">
                        <CheckCircle className="h-10 w-10" />
                    </div>
                    <CardTitle className="text-3xl">Thank you for your order!</CardTitle>
                    <CardDescription>
                        Your order has been placed successfully. A confirmation has been sent to your email.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-left">
                    <p className="font-semibold">Order ID: <span className="font-mono text-muted-foreground">{order._id.toString()}</span></p>
                    <Separator />
                    <h3 className="font-semibold text-lg">Order Summary</h3>
                    <ul className="space-y-2">
                        {order.items.map(item => (
                             <li key={item.productId} className="flex justify-between items-center text-sm">
                                <span>{item.productName} x {item.quantity}</span>
                                <span className="font-medium">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.price * item.quantity)}</span>
                             </li>
                        ))}
                    </ul>
                    <Separator />
                     <div className="space-y-2">
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.subtotal)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.shipping)}</span></div>
                        <div className="flex justify-between font-bold text-lg"><span className="text-foreground">Total</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.total)}</span></div>
                    </div>
                    <Separator />
                    <div>
                        <h3 className="font-semibold text-lg">Shipping to</h3>
                        <div className="text-muted-foreground">
                            <p>{order.shippingAddress.street}</p>
                            <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                            <p>{order.shippingAddress.country}</p>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-center">
                         <Button asChild>
                            <Link href={`/shop/${params.slug}`}>Continue Shopping</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
