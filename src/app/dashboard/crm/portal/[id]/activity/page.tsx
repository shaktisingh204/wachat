import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getPortalUserById } from '@/app/actions/crm-portal.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

import React from 'react';

export default async function PortalActivityPage({ params }: PageProps) {
    const { id } = await params;
    const user = await getPortalUserById(id);
    if (!user) notFound();

    return (
        <EntityDetailShell
            title={user.name || user.email || 'Portal user'}
            eyebrow="PORTAL ACTIVITY"
            back={{ href: `/dashboard/crm/portal/${id}`, label: 'Back to portal user' }}
        >
            <React.Suspense fallback={<div className="h-64 w-full animate-pulse bg-[var(--st-bg-muted)] rounded-md" />}>
                <EntityAuditTimeline entityKind="portal_user" entityId={id} />
            </React.Suspense>
        </EntityDetailShell>
    );
}
