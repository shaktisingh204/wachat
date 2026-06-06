import { Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-64" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-32" />
                </div>
            </div>
            <div className="space-y-4">
                <Skeleton className="h-[400px] w-full" />
            </div>
        </div>
    );
}
