import { Skeleton } from '@/components/zoruui';

export default function NewIntegrationLoading() {
    return (
        <div className="mx-auto max-w-2xl w-full py-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-5 w-96 mb-8" />
            <Skeleton className="h-96 w-full rounded-xl" />
        </div>
    );
}
