import { Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
    return (
        <div className="flex flex-col gap-[var(--st-space-5)] p-1">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-28 rounded-[var(--st-radius)]" />
                    <Skeleton className="h-9 w-28 rounded-[var(--st-radius)]" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-[var(--st-space-3)] md:grid-cols-4">
                <Skeleton className="h-20 w-full rounded-[var(--st-radius-lg)]" />
                <Skeleton className="h-20 w-full rounded-[var(--st-radius-lg)]" />
                <Skeleton className="h-20 w-full rounded-[var(--st-radius-lg)]" />
                <Skeleton className="h-20 w-full rounded-[var(--st-radius-lg)]" />
            </div>
            <div className="flex flex-col gap-2 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] p-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
    );
}
