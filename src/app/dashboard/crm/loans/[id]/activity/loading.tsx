import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingActivity() {
    return (
        <EntityDetailShell
            title="Loading Activity…"
            eyebrow="LOAN ACTIVITY"
        >
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Activity</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="space-y-6">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex gap-4">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-4 w-1/4" />
                                    <Skeleton className="h-4 w-3/4" />
                                </div>
                            </div>
                        ))}
                    </div>
                </ZoruCardContent>
            </Card>
        </EntityDetailShell>
    );
}
