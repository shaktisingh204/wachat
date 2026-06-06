import { fmtDate } from "@/lib/utils";
import { Button, Card, ZoruCardContent, ZoruCardDescription, ZoruCardHeader, ZoruCardTitle, Separator } from '@/components/sabcrm/20ui/compat';
import { getEcommOrderById, getEcommShopBySlug } from '@/app/actions/custom-ecommerce.actions';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';

// Next.js handles layout and loading internally when loading.tsx is present
// but since the requirement says "Implement proper suspense boundaries", 
// leaving it as page component that is just async works natively with loading.tsx.
// We can just rely on loading.tsx for the Suspense fallback.

export default async function OrderDetailsPage({ params }: { params: { slug: string, orderId: string } }) {
    const [order, shop] = await Promise.all([
        getEcommOrderById(params.orderId),
        getEcommShopBySlug(params.slug)
    ]);

    if (!order) {
        notFound();
    }

    const currency = shop?.currency || 'INR';

    return (
        <div className="space-y-4">
             <Button asChild variant="ghost" className="-ml-4">
                 <Link href={`/shop/${params.slug}/account/orders`}>
                    &larr; Back to Order History
                </Link>
            </Button>
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle className="text-2xl">Order Details</ZoruCardTitle>
                    <ZoruCardDescription>
                        Order #{order._id.toString()} - Placed on {fmtDate(order.createdAt)}
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                             <h3 className="font-semibold">Shipping Address</h3>
                             <address className="not-italic text-[var(--st-text-secondary)]">
                                {order.customerInfo.name}<br />
                                {order.shippingAddress.street}<br />
                                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}<br />
                                {order.shippingAddress.country}
                             </address>
                        </div>
                         <div className="space-y-2">
                             <h3 className="font-semibold">Customer Information</h3>
                             <p className="text-[var(--st-text-secondary)]">
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
                                 <li key={item.productId.toString()} className="flex justify-between items-center text-sm">
                                    <span>{item.productName} &times; {item.quantity}</span>
                                    <span className="font-medium">{formatPrice(item.price * item.quantity, currency)}</span>
                                 </li>
                            ))}
                        </ul>
                    </div>
                     <Separator />
                     <div className="space-y-2">
                        <div className="flex justify-between"><span className="text-[var(--st-text-secondary)]">Subtotal</span><span>{formatPrice(order.subtotal, currency)}</span></div>
                        <div className="flex justify-between"><span className="text-[var(--st-text-secondary)]">Shipping</span><span>{formatPrice(order.shipping, currency)}</span></div>
                        <div className="flex justify-between font-bold text-lg"><span className="text-[var(--st-text)]">Total</span><span>{formatPrice(order.total, currency)}</span></div>
                    </div>
                </ZoruCardContent>
            </Card>
        </div>
    );
}
