import { Skeleton } from '@/components/zoruui';
import { Card, CardContent, CardHeader } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function NewTdsLoading() {
    return (
        <EntityListShell
            title="New TDS record"
            subtitle="Record TDS for an employee for a specific FY + quarter."
        >
            <Card className="p-6">
                <CardHeader className="px-0 pt-0">
                    <Skeleton className="h-8 w-[200px]" />
                </CardHeader>
                <CardContent className="space-y-6 px-0 pb-0">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Skeleton className="h-[72px] w-full" />
                        <Skeleton className="h-[72px] w-full" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Skeleton className="h-[72px] w-full" />
                        <Skeleton className="h-[72px] w-full" />
                        <Skeleton className="h-[72px] w-full" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Skeleton className="h-[72px] w-full" />
                        <Skeleton className="h-[72px] w-full" />
                    </div>
                    <Skeleton className="h-[100px] w-full" />
                    <div className="flex justify-between pt-2">
                        <Skeleton className="h-10 w-[150px]" />
                        <Skeleton className="h-10 w-[120px]" />
                    </div>
                </CardContent>
            </Card>
        </EntityListShell>
    );
}
