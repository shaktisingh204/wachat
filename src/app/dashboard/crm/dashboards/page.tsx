import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { LayoutGrid } from 'lucide-react';

export default function CustomDashboardsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Custom Dashboards"
        subtitle="Build your own dashboards with the metrics that matter to your team."
        icon={LayoutGrid}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          Custom dashboards are coming soon. You will be able to drag widgets onto a grid,
          pick data sources, share boards with teammates and pin them to the home screen.
        </p>
      </ZoruCard>
    </div>
  );
}
