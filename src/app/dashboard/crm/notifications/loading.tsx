import { Skeleton } from '@/components/zoruui/skeleton';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function NotificationsLoading() {
    return (
        <EntityListShell
            title="Notifications"
            subtitle="Loading notifications..."
        >
            <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                ))}
            </div>
        </EntityListShell>
    );
}
