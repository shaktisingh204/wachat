import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { Wallet } from 'lucide-react';

export default function PettyCashPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Petty Cash"
        subtitle="Track day-to-day cash floats issued to staff and reconcile receipts."
        icon={Wallet}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          Petty cash management is coming soon. You will be able to maintain custodian
          floats, log expenditures with receipts and top up balances on demand.
        </p>
      </ZoruCard>
    </div>
  );
}
