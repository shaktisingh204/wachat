import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Separator } from '@/components/sabcrm/20ui';
import {
  getEcommOrderById,
  getEcommShopBySlug
} from '@/app/actions/custom-ecommerce.actions';
import { CheckCircle, Package } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { fmtINR } from '@/lib/utils';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function OrderDetails({ orderId, slug }: { orderId: string, slug: string }) {
    const [order, shop] = await Promise.all([
        getEcommOrderById(orderId),
        getEcommShopBySlug(slug)
    ]);

    if (!order || !shop) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <p className="text-xl font-medium">Order not found.</p>
                <Button asChild>
                    <Link href={`/shop/${slug}`}>Back to Shop</Link>
                </Button>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-[var(--st-bg-muted)] text-[var(--st-text)]';
            case 'paid': return 'bg-[var(--st-bg-muted)] text-[var(--st-text)]';
            case 'shipped': return 'bg-[var(--st-bg-muted)] text-[var(--st-text)]';
            case 'delivered': return 'bg-[var(--st-bg-muted)] text-[var(--st-text)]';
            case 'cancelled': return 'bg-[var(--st-bg-muted)] text-[var(--st-text)]';
            default: return 'bg-[var(--st-bg-muted)] text-[var(--st-text)]';
        }
    };

    return (
        <Card className="w-full max-w-2xl text-center">
            <CardHeader>
                <div className="mx-auto bg-[var(--st-bg-muted)] text-[var(--st-text)] rounded-full h-16 w-16 flex items-center justify-center mb-4">
                    <CheckCircle className="h-10 w-10" />
                </div>
                <CardTitle className="text-3xl">Thank you for your order!</CardTitle>
                <CardDescription>
                    Your order has been placed successfully. A confirmation has been sent to your email.
                </CardDescription>
            </CardHeader>
            <CardBody className="space-y-6 text-left">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[var(--st-bg-muted)]/50 rounded-lg">
                    <div>
                        <p className="text-sm text-[var(--st-text-secondary)]">Order ID</p>
                        <p className="font-mono font-medium">{order._id.toString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col items-end">
                            <p className="text-sm text-[var(--st-text-secondary)]">Status</p>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(order.status)}`}>
                                {order.status}
                            </span>
                        </div>
                    </div>
                </div>

                {order.trackingNumber && (
                    <div className="flex items-center gap-3 p-4 border rounded-lg bg-[var(--st-bg-muted)]/50">
                        <Package className="h-6 w-6 text-[var(--st-text)]" />
                        <div>
                            <p className="text-sm font-medium">Tracking Number</p>
                            <p className="font-mono text-sm">{order.trackingNumber}</p>
                        </div>
                    </div>
                )}

                <div>
                    <h3 className="font-semibold text-lg mb-3">Order Summary</h3>
                    <ul className="space-y-3">
                        {order.items.map(item => (
                                <li key={item.productId} className="flex justify-between items-center text-sm">
                                <span className="flex flex-col">
                                    <span className="font-medium">{item.productName}</span>
                                    <span className="text-[var(--st-text-secondary)] text-xs">Qty: {item.quantity} {item.variantInfo ? `| ${item.variantInfo}` : ''}</span>
                                </span>
                                <span className="font-medium">{fmtINR(item.price * item.quantity, shop.currency)}</span>
                                </li>
                        ))}
                    </ul>
                </div>
                
                    <Separator />
                    
                    <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-[var(--st-text-secondary)]">Subtotal</span><span>{fmtINR(order.subtotal, shop.currency)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--st-text-secondary)]">Shipping</span><span>{fmtINR(order.shipping, shop.currency)}</span></div>
                    <div className="flex justify-between font-bold text-lg"><span className="text-[var(--st-text)]">Total</span><span>{fmtINR(order.total, shop.currency)}</span></div>
                </div>
                
                <Separator />
                
                <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold text-base mb-2">Shipping to</h3>
                        <div className="text-sm text-[var(--st-text-secondary)]">
                            <p className="font-medium text-[var(--st-text)]">{order.customerInfo?.name}</p>
                            <p>{order.shippingAddress.street}</p>
                            <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                            <p>{order.shippingAddress.country}</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-base mb-2">Contact Info</h3>
                        <div className="text-sm text-[var(--st-text-secondary)]">
                            <p>{order.customerInfo?.email}</p>
                            {order.customerInfo?.phone && <p>{order.customerInfo.phone}</p>}
                        </div>
                    </div>
                </div>
                
                <div className="pt-4 flex justify-center">
                        <Button asChild size="lg">
                        <Link href={`/shop/${slug}`}>Continue Shopping</Link>
                    </Button>
                </div>
            </CardBody>
        </Card>
    );
}

export default async function OrderConfirmationPage(props: { params: Promise<{ orderId: string, slug: string }> }) {
    const params = await props.params;
    return (
         <div className="container mx-auto px-4 py-12 flex justify-center">
             <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]">Loading order details...</div>}>
                 <OrderDetails orderId={params.orderId} slug={params.slug} />
             </Suspense>
         </div>
    );
}
