import { Skeleton } from '@/components/sabcrm/20ui/compat';

export default function Loading() {
    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-48 rounded-md" />
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-20 rounded-md" />
                    <Skeleton className="h-9 w-20 rounded-md" />
                </div>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    <Skeleton className="h-64 w-full rounded-[var(--zoru-radius)]" />
                    <Skeleton className="h-96 w-full rounded-[var(--zoru-radius)]" />
                </div>
                <div className="space-y-6">
                    <Skeleton className="h-48 w-full rounded-[var(--zoru-radius)]" />
                    <Skeleton className="h-48 w-full rounded-[var(--zoru-radius)]" />
                </div>
            </div>
        </div>
    );
}
