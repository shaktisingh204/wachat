'use client';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function DashboardsLoading() {
    return (
        <EntityListShell
            title="Custom Dashboards"
            subtitle="Build your own dashboards with the metrics that matter to your team."
            primaryAction={
                <Button variant="outline" disabled>
                    <Plus className="h-4 w-4" strokeWidth={1.75} />
                    New dashboard
                </Button>
            }
            loading={true}
        >
            <div />
        </EntityListShell>
    );
}
