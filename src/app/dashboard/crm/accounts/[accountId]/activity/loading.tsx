import { Skeleton } from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function AccountActivityLoading() {
    return (
        <EntityDetailShell
            eyebrow="ACCOUNT ACTIVITY"
            title="Loading Activity..."
            back={{
                href: '#',
                label: 'Back to account',
            }}
        >
            <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        </EntityDetailShell>
    );
}
