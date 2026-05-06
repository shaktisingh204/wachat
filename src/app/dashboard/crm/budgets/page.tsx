import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { Target } from 'lucide-react';

export default function BudgetsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Budgets & Forecasting"
        subtitle="Plan revenue and expense targets, then track actuals against them."
        icon={Target}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          Budgets and forecasting are coming soon. You will be able to set period budgets
          per account or department and view live variance against booked transactions.
        </p>
      </ZoruCard>
    </div>
  );
}
