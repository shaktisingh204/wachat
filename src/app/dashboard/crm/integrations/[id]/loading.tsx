import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function IntegrationDetailLoading() {
    return (
        <EntityDetailShell
            title={<Skeleton className="h-8 w-48 inline-block" />}
            subtitle={<Skeleton className="h-5 w-64 inline-block mt-1" />}
            headerTone="default"
        >
            <div className="space-y-6 mt-6">
                <Skeleton className="h-64 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
            </div>
        </EntityDetailShell>
    );
}
