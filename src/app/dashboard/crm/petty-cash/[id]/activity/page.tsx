import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getPettyCashFloatById } from '@/app/actions/crm-petty-cash.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

import React from 'react';

export default async function PettyCashActivityPage({ params }: PageProps) {
    const { id } = await params;
    const float = await getPettyCashFloatById(id);
    if (!float) notFound();

    return (
        <EntityDetailShell
            title={float.name || 'Petty Cash Float'}
            eyebrow="PETTY CASH ACTIVITY"
            back={{ href: `/dashboard/crm/petty-cash/${id}`, label: 'Back to float' }}
        >
            <React.Suspense fallback={<div className="h-64 w-full animate-pulse bg-zoru-surface-2 rounded-md" />}>
                <EntityAuditTimeline entityKind="petty_cash" entityId={id} />
            </React.Suspense>
        </EntityDetailShell>
    );
}
