import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { PackageCheck } from 'lucide-react';

export default function GrnPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Goods Receipt (GRN)"
        subtitle="Record incoming stock against purchase orders and reconcile quantities."
        icon={PackageCheck}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          The GRN module is coming soon. You will be able to receive goods against POs,
          handle partial receipts, capture quality checks and update stock automatically.
        </p>
      </ZoruCard>
    </div>
  );
}
