import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { Gavel } from 'lucide-react';

export default function DisciplinaryPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Disciplinary Cases"
        subtitle="Record warnings, investigations and outcomes of disciplinary action."
        icon={Gavel}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          Disciplinary case management is coming soon. You will be able to log incidents,
          attach evidence, route approvals and keep a confidential audit trail per employee.
        </p>
      </ZoruCard>
    </div>
  );
}
