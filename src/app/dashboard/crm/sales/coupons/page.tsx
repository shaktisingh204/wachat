import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { TicketPercent } from 'lucide-react';

export default function CouponsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Coupons & Promotions"
        subtitle="Create discount codes, scheduled offers and customer-segment promotions."
        icon={TicketPercent}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          Coupons and promotions are coming soon. You will be able to issue percentage
          and flat-amount codes, set usage limits and track redemption performance.
        </p>
      </ZoruCard>
    </div>
  );
}
