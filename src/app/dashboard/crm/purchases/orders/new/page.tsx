'use server';

import { Suspense } from 'react';
import { NewPurchaseOrderForm } from './new-order-form';

export default async function NewPurchaseOrderPage() {
    return (
        <div className="max-w-5xl mx-auto py-6">
            <h1 className="text-2xl font-bold mb-6">Create New Purchase Order</h1>
            <Suspense fallback={<div>Loading...</div>}>
                <NewPurchaseOrderForm />
            </Suspense>
        </div>
    );
}
