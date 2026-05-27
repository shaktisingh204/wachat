import { Skeleton } from '@/components/zoruui';

export default function Loading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-6">
            <div className="flex flex-col items-center space-y-4 w-full max-w-md text-center">
                <Skeleton className="w-16 h-16 rounded-full" />
                <Skeleton className="w-3/4 h-8" />
                <Skeleton className="w-1/2 h-4" />
                <div className="w-full space-y-2 mt-8">
                    <Skeleton className="w-full h-4" />
                    <Skeleton className="w-full h-4" />
                    <Skeleton className="w-5/6 h-4" />
                </div>
            </div>
        </div>
    );
}
