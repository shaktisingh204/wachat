import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { Building2 } from 'lucide-react';

export default function FixedAssetsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Fixed Assets"
        subtitle="Maintain a register of capital assets with depreciation and disposal tracking."
        icon={Building2}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          Fixed asset management is coming soon. You will be able to capitalise purchases,
          run depreciation schedules and post disposals straight to the ledger.
        </p>
      </ZoruCard>
    </div>
  );
}
