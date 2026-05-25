import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Download } from 'lucide-react';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getDashboardById } from '@/app/actions/crm-dashboards.actions';
import { Button, Skeleton } from '@/components/zoruui';
import { DashboardActivityClient } from './dashboard-activity-client';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function DashboardActivityPage({ params }: PageProps) {
    const { id } = await params;
    const d = await getDashboardById(id);
    
    if (!d) notFound();

    return (
        <DashboardActivityClient>
            <EntityDetailShell
                title={d.name || 'Dashboard'}
                eyebrow="DASHBOARD ACTIVITY"
                back={{ href: `/dashboard/crm/dashboards/${id}`, label: 'Back to dashboard' }}
                actions={
                    <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export Log
                    </Button>
                }
            >
                <Suspense fallback={<div className="space-y-4"><Skeleton className="h-[200px] w-full" /></div>}>
                    <EntityAuditTimeline entityKind="dashboard" entityId={id} />
                </Suspense>
            </EntityDetailShell>
        </DashboardActivityClient>
    );
}
