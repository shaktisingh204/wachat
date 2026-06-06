import { Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
    return (
        <div className="flex h-screen w-full bg-[var(--st-bg-secondary)] dark:bg-[var(--st-text)] overflow-hidden relative">
            <div className="w-full flex flex-col">
                {/* Header Skeleton */}
                <div className="flex-none h-14 border-b flex items-center justify-between px-4 bg-[var(--st-bg-secondary)]/70 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-6 w-32" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-9 w-24 rounded-md" />
                        <Skeleton className="h-9 w-28 rounded-md" />
                    </div>
                </div>

                {/* Main Content Area Skeleton */}
                <div className="flex-1 flex overflow-hidden relative">
                    <div className="flex-1 p-8 flex flex-col items-center">
                        {/* Canvas Skeleton */}
                        <div className="w-full max-w-[1200px] bg-[var(--st-bg-secondary)]/50 border rounded-xl shadow-sm min-h-[600px] p-8 flex flex-col gap-6">
                            <Skeleton className="h-24 w-full rounded-lg opacity-50" />
                            <Skeleton className="h-64 w-full rounded-lg opacity-50" />
                            <div className="grid grid-cols-2 gap-6">
                                <Skeleton className="h-48 w-full rounded-lg opacity-50" />
                                <Skeleton className="h-48 w-full rounded-lg opacity-50" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
