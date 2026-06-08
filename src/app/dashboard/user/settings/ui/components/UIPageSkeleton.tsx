import { Card, CardHeader, CardBody, CardFooter, Separator, Skeleton } from '@/components/sabcrm/20ui';

export function UIPageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-72" />
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="mt-2 h-4 w-56" />
                </CardHeader>
                <CardBody className="space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-64" />
                        <div className="flex gap-4 pt-2">
                            <Skeleton className="h-6 w-28" />
                            <Skeleton className="h-6 w-28" />
                        </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-10 w-full max-w-sm" />
                    </div>
                </CardBody>
                <CardFooter>
                    <Skeleton className="h-10 w-36" />
                </CardFooter>
            </Card>
        </div>
    );
}
