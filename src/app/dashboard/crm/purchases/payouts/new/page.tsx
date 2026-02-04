'use server';

import { Suspense } from 'react';
import { NewPayoutForm } from './new-payout-form';

export default async function NewPayoutPage() {
    return (
        <div className="max-w-2xl mx-auto py-6">
            <h1 className="text-2xl font-bold mb-6">Record Payout</h1>
            <Suspense fallback={<div>Loading...</div>}>
                <NewPayoutForm />
            </Suspense>
        </div>
    );
}
