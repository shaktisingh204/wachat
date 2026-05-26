import { Skeleton } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function EditShiftRotationLoading() {
    return (
        <EntityListShell
            title="Edit · Loading..."
            subtitle="Update rotation scope, pattern and cycle."
        >
            <div className="space-y-6 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-6 shadow-sm">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-24 w-full" />
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>

                <div className="rounded-[var(--zoru-radius)] border border-zoru-line p-4">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="space-y-1">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-3 w-40" />
                        </div>
                        <Skeleton className="h-9 w-24" />
                    </div>
                    
                    <div className="space-y-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-24" />
                </div>
            </div>
        </EntityListShell>
    );
}
