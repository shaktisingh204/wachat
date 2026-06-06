import { Skeleton } from '@/components/sabcrm/20ui/compat';

export default function LoadingEntityPage() {
    return (
        <div className="flex w-full flex-col gap-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-[400px] w-full" />
            <div className="mt-6 flex flex-col gap-2">
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-[200px] w-full" />
            </div>
        </div>
    );
}
