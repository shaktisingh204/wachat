import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { Gift } from 'lucide-react';

export default function GiftCardsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Gift Cards"
        subtitle="Issue prepaid value cards your customers can redeem against any order."
        icon={Gift}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          Gift cards are coming soon. You will be able to mint card codes, set balances
          and expiry, send delivery emails and track redemption history.
        </p>
      </ZoruCard>
    </div>
  );
}
