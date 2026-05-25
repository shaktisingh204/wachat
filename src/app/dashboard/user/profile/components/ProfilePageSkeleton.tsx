import { Card, ZoruCardContent, ZoruCardFooter, ZoruCardHeader, Skeleton } from '@/components/zoruui';

export function ProfilePageSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-48" />
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-start">
                <Card>
                    <ZoruCardHeader>
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-64 mt-2" />
                    </ZoruCardHeader>
                    <ZoruCardContent className="space-y-5">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </ZoruCardContent>
                    <ZoruCardFooter>
                        <Skeleton className="h-10 w-32" />
                    </ZoruCardFooter>
                </Card>
                <Card>
                    <ZoruCardHeader>
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-64 mt-2" />
                    </ZoruCardHeader>
                    <ZoruCardContent className="space-y-5">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </ZoruCardContent>
                    <ZoruCardFooter>
                        <Skeleton className="h-10 w-36" />
                    </ZoruCardFooter>
                </Card>
            </div>
            <Card>
                <ZoruCardHeader>
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-64 mt-2" />
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-5">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <Skeleton className="h-10 w-48" />
                </ZoruCardFooter>
            </Card>
        </div>
    );
}
