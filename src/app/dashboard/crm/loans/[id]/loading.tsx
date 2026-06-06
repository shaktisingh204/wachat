import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function LoanDetailLoading() {
  return (
    <EntityDetailShell
      title="Loading..."
      eyebrow="LOAN"
      back={{ href: '/dashboard/crm/loans', label: 'Back to loans' }}
    >
      <div className="space-y-4">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </EntityDetailShell>
  );
}
