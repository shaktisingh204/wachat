import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Skeleton, Card } from '@/components/sabcrm/20ui/compat';

export default function BankTransactionDetailLoading() {
  return (
    <EntityDetailShell
      eyebrow="BANK TRANSACTION"
      title="Loading Transaction..."
      back={{ href: '/dashboard/crm/banking/bank-transactions', label: 'Bank Transactions' }}
    >
      <div className="space-y-6">
        {/* Summary Skeleton */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-16 w-full max-w-md" />
            </div>
          </div>
        </Card>

        {/* Linked voucher & Status actions skeleton */}
        <Card className="p-4">
           <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
           </div>
        </Card>
      </div>
    </EntityDetailShell>
  );
}
