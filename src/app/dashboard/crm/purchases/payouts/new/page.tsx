import { Suspense } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { NewPayoutForm } from './new-payout-form';
import { CrmPageHeader } from '../../../_components/crm-page-header';

export default async function NewPayoutPage() {
    return (
        <div className="flex flex-col gap-6 max-w-2xl">
            <CrmPageHeader
                title="Record Payout"
                subtitle="Record a payment made to a vendor."
                icon={ArrowUpRight}
            />
            <Suspense fallback={<div className="text-[13px] text-clay-ink-muted">Loading...</div>}>
                <NewPayoutForm />
            </Suspense>
        </div>
    );
}
