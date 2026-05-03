import { Suspense } from 'react';
import { ShoppingBag } from 'lucide-react';
import { NewPurchaseOrderForm } from './new-order-form';
import { CrmPageHeader } from '../../../_components/crm-page-header';

export default async function NewPurchaseOrderPage() {
    return (
        <div className="flex flex-col gap-6 max-w-5xl">
            <CrmPageHeader
                title="Create New Purchase Order"
                subtitle="Add a new purchase order for your vendor."
                icon={ShoppingBag}
            />
            <Suspense fallback={<div className="text-[13px] text-clay-ink-muted">Loading...</div>}>
                <NewPurchaseOrderForm />
            </Suspense>
        </div>
    );
}
