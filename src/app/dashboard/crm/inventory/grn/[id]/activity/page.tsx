import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/zoruui';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getGrn } from '@/app/actions/crm/grns.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function GrnActivityPage({ params }: PageProps) {
    const { id } = await params;
    const { grn, error } = await getGrn(id);
    if (!grn || error) notFound();

    return (
        <EntityDetailShell
            title={grn.grnNo || 'GRN'}
            eyebrow="GRN ACTIVITY"
            back={{
                href: `/dashboard/crm/inventory/grn/${id}`,
                label: 'Back to GRN',
            }}
        >
            <Suspense fallback={<Skeleton className="w-full h-48" />}>
                <EntityAuditTimeline entityKind="grn" entityId={id} />
            </Suspense>
        </EntityDetailShell>
    );
}
