import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { HandCoins } from 'lucide-react';

export default function LoansPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Loans & Advances"
        subtitle="Issue staff or vendor loans and track scheduled repayments."
        icon={HandCoins}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          Loans and advances are coming soon. You will be able to set repayment schedules,
          deduct EMIs from payroll and monitor outstanding principal and interest.
        </p>
      </ZoruCard>
    </div>
  );
}
