import { ZoruButton, ZoruCard } from '@/components/zoruui';
import { Plus, Columns3 } from 'lucide-react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function PipelinesPage() {
  return (
    <EntityListShell
      title="Pipelines"
      subtitle="Create and manage multiple sales pipelines to track your deals."
      primaryAction={
        <Link href="/dashboard/crm/sales-crm/pipelines/new">
          <ZoruButton>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New Pipeline
          </ZoruButton>
        </Link>
      }
    >

      <ZoruCard className="p-6 border-dashed">
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zoru-surface-2">
            <Columns3 className="h-6 w-6 text-zoru-ink" strokeWidth={1.75} />
          </div>
          <h3 className="text-[15px] text-zoru-ink">No Pipelines Found</h3>
          <p className="text-[12.5px] text-zoru-ink-muted">
            You haven&apos;t created any pipelines yet. Head to the Sales CRM pipeline manager
            to create one.
          </p>
          <Link href="/dashboard/crm/sales-crm/pipelines">
            <ZoruButton>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Open Pipeline Manager
            </ZoruButton>
          </Link>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
