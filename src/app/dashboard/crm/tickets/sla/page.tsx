import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { Timer } from 'lucide-react';

export default function SlaPoliciesPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="SLA Policies"
        subtitle="Define first-response and resolution targets per ticket priority."
        icon={Timer}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          SLA policies are coming soon. You will be able to set business-hour-aware
          response and resolution clocks, configure escalations and track breach risk.
        </p>
      </ZoruCard>
    </div>
  );
}
