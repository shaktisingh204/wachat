import { Plus, Columns3 } from 'lucide-react';
import Link from 'next/link';

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function PipelinesPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Pipelines"
        subtitle="Create and manage multiple sales pipelines to track your deals."
        icon={Columns3}
        actions={
          <Link href="/dashboard/crm/sales-crm/pipelines/new">
            <ClayButton
              variant="obsidian"
              leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            >
              New Pipeline
            </ClayButton>
          </Link>
        }
      />

      <ClayCard variant="outline" className="border-dashed">
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
            <Columns3 className="h-6 w-6 text-accent-foreground" strokeWidth={1.75} />
          </div>
          <h3 className="text-[15px] font-semibold text-foreground">No Pipelines Found</h3>
          <p className="text-[12.5px] text-muted-foreground">
            You haven&apos;t created any pipelines yet. Head to the Sales CRM pipeline manager
            to create one.
          </p>
          <Link href="/dashboard/crm/sales-crm/pipelines">
            <ClayButton
              variant="obsidian"
              leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            >
              Open Pipeline Manager
            </ClayButton>
          </Link>
        </div>
      </ClayCard>
    </div>
  );
}
