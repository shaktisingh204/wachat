'use client';

import { Skeleton } from '@/components/sabcrm/20ui/compat';

export default function SettingsLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-8 w-1/4 mb-2" />
                <Skeleton className="h-4 w-1/3" />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border bg-[var(--st-bg-secondary)] text-[var(--st-text)] shadow">
                        <div className="flex flex-col space-y-1.5 p-6">
                            <Skeleton className="h-6 w-1/2" />
                            <Skeleton className="h-4 w-full mt-2" />
                        </div>
                        <div className="p-6 pt-0">
                            <Skeleton className="h-16 w-full" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
