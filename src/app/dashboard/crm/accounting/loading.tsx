import { Skeleton } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function AccountingHubLoading() {
    return (
        <EntityListShell
            title="Accounting"
            subtitle="Books, vouchers, and the four primary financial reports."
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="rounded-xl border p-4 flex gap-4">
                            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                            <div className="space-y-2 w-full">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="rounded-xl border p-6">
                    <Skeleton className="h-6 w-48 mb-6" />
                    <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                                <div className="space-y-2">
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
