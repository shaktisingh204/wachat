import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { Award } from 'lucide-react';

export default function LoyaltyPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Loyalty Program"
        subtitle="Reward repeat customers with points, tiers and redeemable perks."
        icon={Award}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          The loyalty program is coming soon. You will be able to define earn rules,
          configure tiered benefits and let customers redeem points at checkout.
        </p>
      </ZoruCard>
    </div>
  );
}
