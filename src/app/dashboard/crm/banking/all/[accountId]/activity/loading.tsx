import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function ActivityLoading() {
    return (
        <EntityDetailShell
            eyebrow="PAYMENT ACCOUNT"
            title="Loading..."
            status={{ label: 'Loading', tone: 'neutral' }}
        >
            <div className="space-y-6">
                <Skeleton className="h-24 w-full rounded-[var(--st-radius-lg)]" />
                <Skeleton className="h-24 w-full rounded-[var(--st-radius-lg)]" />
                <Skeleton className="h-24 w-full rounded-[var(--st-radius-lg)]" />
            </div>
        </EntityDetailShell>
    );
}
