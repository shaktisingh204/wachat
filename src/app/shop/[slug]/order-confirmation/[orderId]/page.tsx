import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Separator,
} from '@/components/zoruui';
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
            case 'pending': return 'bg-zoru-surface-2 text-zoru-ink';
            case 'paid': return 'bg-zoru-surface-2 text-zoru-ink';
            case 'shipped': return 'bg-zoru-surface-2 text-zoru-ink';
            case 'delivered': return 'bg-zoru-surface-2 text-zoru-ink';
            case 'cancelled': return 'bg-zoru-surface-2 text-zoru-ink';
            default: return 'bg-zoru-surface-2 text-zoru-ink';
        }
    };

    return (
        <Card className="w-full max-w-2xl text-center">
            <ZoruCardHeader>
                <div className="mx-auto bg-zoru-surface-2 text-zoru-ink rounded-full h-16 w-16 flex items-center justify-center mb-4">
                    <CheckCircle className="h-10 w-10" />
                </div>
                <ZoruCardTitle className="text-3xl">Thank you for your order!</ZoruCardTitle>
                <ZoruCardDescription>
                    Your order has been placed successfully. A confirmation has been sent to your email.
                </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-6 text-left">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zoru-surface-2/50 rounded-lg">
                    <div>
                        <p className="text-sm text-zoru-ink-muted">Order ID</p>
                        <p className="font-mono font-medium">{order._id.toString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col items-end">
                            <p className="text-sm text-zoru-ink-muted">Status</p>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(order.status)}`}>
                                {order.status}
                            </span>
                        </div>
                    </div>
                </div>

                {order.trackingNumber && (
                    <div className="flex items-center gap-3 p-4 border rounded-lg bg-zoru-surface-2/50">
                        <Package className="h-6 w-6 text-zoru-ink" />
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
                                    <span className="text-zoru-ink-muted text-xs">Qty: {item.quantity} {item.variantInfo ? `| ${item.variantInfo}` : ''}</span>
                                </span>
                                <span className="font-medium">{fmtINR(item.price * item.quantity, shop.currency)}</span>
                                </li>
                        ))}
                    </ul>
                </div>
                
                    <Separator />
                    
                    <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-zoru-ink-muted">Subtotal</span><span>{fmtINR(order.subtotal, shop.currency)}</span></div>
                    <div className="flex justify-between"><span className="text-zoru-ink-muted">Shipping</span><span>{fmtINR(order.shipping, shop.currency)}</span></div>
                    <div className="flex justify-between font-bold text-lg"><span className="text-zoru-ink">Total</span><span>{fmtINR(order.total, shop.currency)}</span></div>
                </div>
                
                <Separator />
                
                <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold text-base mb-2">Shipping to</h3>
                        <div className="text-sm text-zoru-ink-muted">
                            <p className="font-medium text-zoru-ink">{order.customerInfo?.name}</p>
                            <p>{order.shippingAddress.street}</p>
                            <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                            <p>{order.shippingAddress.country}</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-base mb-2">Contact Info</h3>
                        <div className="text-sm text-zoru-ink-muted">
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
            </ZoruCardContent>
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
