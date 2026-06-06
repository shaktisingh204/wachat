import { Skeleton } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { HubKpiGrid } from '../_components/hub-kpi-grid';
import { IntegrationsSearch } from './_components/integrations-search';

export default function Loading() {
    return (
        <EntityListShell
            title="Integrations"
            subtitle="Connect your CRM to other tools and services to streamline your workflow."
        >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
            </div>
            
            <IntegrationsSearch />
            
            <div className="mb-8">
                <Skeleton className="h-6 w-48 mb-4 rounded" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-48 w-full rounded-xl" />
                    ))}
                </div>
            </div>
            
            <div className="mb-4 flex items-center justify-between">
                <Skeleton className="h-6 w-48 rounded" />
                <Skeleton className="h-9 w-32 rounded-full" />
            </div>
            
            <Skeleton className="h-24 w-full rounded-xl" />
        </EntityListShell>
    );
}
