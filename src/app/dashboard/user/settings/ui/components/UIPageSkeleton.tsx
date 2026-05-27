import {
    Card,
    ZoruCardHeader,
    ZoruCardContent,
    ZoruCardFooter,
    Skeleton,
} from '@/components/zoruui';

export function UIPageSkeleton() {
    return (
        <Card>
            <ZoruCardHeader>
                <Skeleton className="h-6 w-1/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-64" />
                    <div className="flex gap-4 pt-2">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-24" />
                    </div>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-zoru-line">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-72" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-10" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Skeleton key={i} className="h-16 w-full rounded-md" />
                        ))}
                    </div>
                </div>
            </ZoruCardContent>
            <ZoruCardFooter>
                <Skeleton className="h-10 w-36" />
            </ZoruCardFooter>
        </Card>
    );
}
