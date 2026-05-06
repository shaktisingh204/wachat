import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { Trophy } from 'lucide-react';

export default function AwardsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Awards & Recognition Programs"
        subtitle="Celebrate top performers with structured awards and peer nominations."
        icon={Trophy}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          Awards and recognition programs are coming soon. You will be able to define
          award categories, run nomination cycles and publish winners across the company.
        </p>
      </ZoruCard>
    </div>
  );
}
