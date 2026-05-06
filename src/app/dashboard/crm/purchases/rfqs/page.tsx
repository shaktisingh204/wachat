import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { ClipboardList } from 'lucide-react';

export default function RfqsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="RFQs / Bids"
        subtitle="Send requests for quotation to vendors and compare bids side by side."
        icon={ClipboardList}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          RFQs and competitive bidding are coming soon. You will be able to invite
          multiple vendors, score responses and convert the winning bid into a PO.
        </p>
      </ZoruCard>
    </div>
  );
}
