import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { Globe } from 'lucide-react';

export default function CustomerPortalPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Customer Portal"
        subtitle="Self-service portal where customers see invoices, tickets and documents."
        icon={Globe}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          The customer portal is coming soon. You will be able to brand a public portal,
          let customers pay invoices, raise tickets and download statements at any time.
        </p>
      </ZoruCard>
    </div>
  );
}
