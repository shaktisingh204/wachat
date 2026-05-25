import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Skeleton } from '@/components/zoruui';

export default function EditIntegrationLoading() {
    return (
        <EntityDetailShell
            eyebrow="INTEGRATION"
            title="Loading Integration..."
        >
            <div className="space-y-6">
                <Skeleton className="h-[600px] w-full rounded-md" />
            </div>
        </EntityDetailShell>
    );
}
