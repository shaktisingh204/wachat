import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { Repeat } from 'lucide-react';

export default function SubscriptionsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Subscriptions & Recurring"
        subtitle="Manage recurring billing plans, renewals and dunning workflows."
        icon={Repeat}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          Subscriptions and recurring revenue tools are coming soon. You will be able to
          define plans, attach customers, automate invoice generation and track MRR / churn.
        </p>
      </ZoruCard>
    </div>
  );
}
