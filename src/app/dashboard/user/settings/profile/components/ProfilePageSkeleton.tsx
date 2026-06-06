import { Card, CardBody, CardFooter, CardHeader, Skeleton } from '@/components/sabcrm/20ui/compat';

export function ProfilePageSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-48" />
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-start">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-64 mt-2" />
                    </CardHeader>
                    <CardBody className="space-y-5">
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
                    </CardBody>
                    <CardFooter>
                        <Skeleton className="h-10 w-32" />
                    </CardFooter>
                </Card>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-64 mt-2" />
                    </CardHeader>
                    <CardBody className="space-y-5">
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
                    </CardBody>
                    <CardFooter>
                        <Skeleton className="h-10 w-36" />
                    </CardFooter>
                </Card>
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardBody className="space-y-5">
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
                </CardBody>
                <CardFooter>
                    <Skeleton className="h-10 w-48" />
                </CardFooter>
            </Card>
        </div>
    );
}
