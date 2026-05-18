'use client';

import { ZoruButton, ZoruCard, ZoruCardContent, ZoruCardDescription, ZoruCardHeader, ZoruCardTitle, ZoruSeparator } from '@/components/zoruui';
import {
  getEcommOrderById } from '@/app/actions/custom-ecommerce.actions';

import type { WithId, EcommOrder } from '@/lib/definitions';
import { CheckCircle, Package } from 'lucide-react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OrderDetailsPage() {
    const params = useParams();
    const [order, setOrder] = useState<WithId<EcommOrder> | null>(null);

    useEffect(() => {
        if(params.orderId) {
            getEcommOrderById(params.orderId as string).then(setOrder);
        }
    }, [params.orderId]);

    if (!order) {
        return <div>Loading...</div>; // Add skeleton loader here
    }

    return (
        <div className="space-y-4">
             <ZoruButton asChild variant="ghost" className="-ml-4">
                 <Link href={`/shop/${params.slug}/account/orders`}>
                    &larr; Back to Order History
                </Link>
            </ZoruButton>
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle className="text-2xl">Order Details</ZoruCardTitle>
                    <ZoruCardDescription>
                        Order #{order._id.toString()} - Placed on {new Date(order.createdAt).toLocaleDateString()}
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-6">
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
                     <ZoruSeparator />
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
                     <ZoruSeparator />
                     <div className="space-y-2">
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.subtotal)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.shipping)}</span></div>
                        <div className="flex justify-between font-bold text-lg"><span className="text-foreground">Total</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.total)}</span></div>
                    </div>
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
