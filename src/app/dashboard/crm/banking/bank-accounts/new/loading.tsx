import { Skeleton } from '@/components/sabcrm/20ui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

const BASE = '/dashboard/crm/banking/bank-accounts';

export default function NewBankAccountLoading() {
    return (
        <EntityDetailShell
            eyebrow="BANK ACCOUNT"
            title="New Bank Account"
            back={{ href: BASE, label: 'Bank Accounts' }}
        >
            <div className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-[200px]" />
                    <Skeleton className="h-4 w-[300px]" />
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                </div>
            </div>
        </EntityDetailShell>
    );
}
