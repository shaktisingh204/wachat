/**
 * BOM activity (audit log) — server route.
 *
 * Linked from the BOM detail page. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'bom'`.
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmBomById } from '@/app/actions/crm-bom.actions';
import { withTimeout } from '../../lib/timeout';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BomActivityPage({ params }: PageProps) {
  const { id } = await params;
  const bom = await withTimeout(getCrmBomById(id), 10000);
  if (!bom) notFound();

  const title = bom.bomNo || bom.finishedGoodName || 'BOM';

  return (
    <EntityDetailShell
      title={title}
      eyebrow="BOM ACTIVITY"
      back={{
        href: `/dashboard/crm/inventory/bom/${id}`,
        label: 'Back to BOM',
      }}
    >
      <Suspense fallback={<TimelineSkeleton />}>
        <EntityAuditTimeline entityKind="bom" entityId={id} />
      </Suspense>
    </EntityDetailShell>
  );
}

function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-6 w-32" />
      <div className="space-y-4 border-l-2 border-zoru-line ml-3 pl-6">
        <div className="space-y-2 relative">
          <div className="absolute w-3 h-3 bg-zoru-line rounded-full -left-[1.95rem] top-1" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="space-y-2 relative">
          <div className="absolute w-3 h-3 bg-zoru-line rounded-full -left-[1.95rem] top-1" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="space-y-2 relative">
          <div className="absolute w-3 h-3 bg-zoru-line rounded-full -left-[1.95rem] top-1" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
