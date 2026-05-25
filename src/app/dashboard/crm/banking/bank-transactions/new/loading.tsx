import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Skeleton } from '@/components/zoruui';

export default function NewBankTransactionLoading() {
  return (
    <EntityDetailShell
      eyebrow="BANK TRANSACTION"
      title="New Bank Transaction"
      back={{ href: '/dashboard/crm/banking/bank-transactions', label: 'Bank Transactions' }}
    >
      <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-4">
            <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
            </div>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>

            <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
            </div>
            
            <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-24 w-full" />
            </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-6">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    </EntityDetailShell>
  );
}
