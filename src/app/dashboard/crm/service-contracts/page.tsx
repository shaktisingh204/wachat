import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { Wrench } from 'lucide-react';

export default function ServiceContractsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Service Contracts (AMC)"
        subtitle="Track annual maintenance contracts, covered assets and renewal dates."
        icon={Wrench}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          AMC and service contracts are coming soon. You will be able to map contracts to
          assets, schedule preventive visits and bill customers on the agreed cadence.
        </p>
      </ZoruCard>
    </div>
  );
}
