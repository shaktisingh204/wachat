import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { ScrollText } from 'lucide-react';

export default function AuditLogPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Audit Log"
        subtitle="Immutable record of every create, update and delete across the CRM."
        icon={ScrollText}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          The audit log is coming soon. You will be able to filter by actor, entity or
          action and export trails for compliance and security reviews.
        </p>
      </ZoruCard>
    </div>
  );
}
