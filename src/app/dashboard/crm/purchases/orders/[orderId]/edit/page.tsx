import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShoppingBag } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { NewPurchaseOrderForm } from '../../new/new-order-form';
import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { getPurchaseOrderById } from '@/app/actions/crm-purchase-orders.actions';

export default async function EditPurchaseOrderPage(
    props: { params: Promise<{ orderId: string }> }
) {
    const { orderId } = await props.params;
    const order = await getPurchaseOrderById(orderId);

    if (!order) {
        notFound();
    }

    return (
        <div className="flex flex-col gap-6 max-w-5xl">
            <Link href="/dashboard/crm/purchases/orders" className="inline-flex">
                <ZoruButton variant="ghost">
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
                    Back to Purchase Orders
                </ZoruButton>
            </Link>
            <CrmPageHeader
                title={`Edit Purchase Order ${order.orderNumber}`}
                subtitle="Update purchase order details."
                icon={ShoppingBag}
            />
            <Suspense fallback={<div className="text-[13px] text-muted-foreground">Loading...</div>}>
                <NewPurchaseOrderForm order={order} />
            </Suspense>
        </div>
    );
}
