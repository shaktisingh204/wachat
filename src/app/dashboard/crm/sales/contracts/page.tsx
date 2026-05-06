import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { FileSignature } from 'lucide-react';

export default function SalesContractsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Contracts"
        subtitle="Draft, send, e-sign and track customer contracts in one place."
        icon={FileSignature}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          The contracts workspace is coming soon. You will be able to create contract
          templates, capture e-signatures and monitor expirations and renewals.
        </p>
      </ZoruCard>
    </div>
  );
}
