import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getCrmPaymentAccountById } from '@/app/actions/crm-payment-accounts.actions';
import { Skeleton } from '@/components/zoruui/skeleton';

export default async function PaymentAccountActivityPage(props: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await props.params;
    const account = await getCrmPaymentAccountById(accountId);
    
    if (!account) {
        notFound();
    }

    const isActive = account.status === 'active';

    return (
        <EntityDetailShell
            eyebrow="PAYMENT ACCOUNT ACTIVITY"
            title={account.accountName}
            status={{
                label: account.status || 'unknown',
                tone: isActive ? 'green' : 'neutral'
            }}
            back={{ href: `/dashboard/crm/banking/all/${accountId}`, label: 'Back to account' }}
        >
            <div className="flex flex-col gap-6">
                <div>
                    <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                        Activity History
                    </h2>
                    <p className="text-sm text-zinc-500">
                        A comprehensive audit trail of all changes, transactions, and events associated with this payment account.
                    </p>
                </div>
                
                <Suspense 
                    fallback={
                        <div className="space-y-4">
                            <Skeleton className="h-32 w-full rounded-[var(--zoru-radius-lg)]" />
                            <Skeleton className="h-24 w-full rounded-[var(--zoru-radius-lg)]" />
                            <Skeleton className="h-24 w-full rounded-[var(--zoru-radius-lg)]" />
                        </div>
                    }
                >
                    <EntityAuditTimeline 
                        entityKind="payment_account" 
                        entityId={accountId} 
                        title="Audit Log" 
                    />
                </Suspense>
            </div>
        </EntityDetailShell>
    );
}
