import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { Layers } from 'lucide-react';

export default function BomPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Bill of Materials (BOM)"
        subtitle="Define multi-level product recipes for assembly and manufacturing."
        icon={Layers}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          BOM management is coming soon. You will be able to compose finished goods from
          components, track sub-assemblies and roll up cost across BOM levels.
        </p>
      </ZoruCard>
    </div>
  );
}
