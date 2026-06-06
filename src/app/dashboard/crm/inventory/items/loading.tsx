import { Skeleton } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function ItemsLoading() {
    return (
        <EntityListShell
            title="Items & Goods"
            subtitle="Manage your inventory, services, and bundle products."
        >
            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-xl border p-6 flex flex-col justify-between h-[120px]">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-8 w-32" />
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="rounded-xl border flex flex-col">
                    <div className="p-4 border-b flex justify-between">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-10 w-24" />
                    </div>
                    <div className="p-4 space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                                <Skeleton className="h-12 w-12 rounded-lg" />
                                <div className="space-y-2 flex-1 ml-4">
                                    <Skeleton className="h-5 w-40" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <Skeleton className="h-5 w-24" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </EntityListShell>
    );
}
