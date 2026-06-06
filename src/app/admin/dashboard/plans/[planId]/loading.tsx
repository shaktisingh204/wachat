import { Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}
