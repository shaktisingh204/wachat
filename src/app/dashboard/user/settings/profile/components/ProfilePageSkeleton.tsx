import { Card, CardBody, CardFooter, CardHeader, Skeleton } from '@/components/sabcrm/20ui';

function FormCardSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="mt-2 h-4 w-64" />
            </CardHeader>
            <CardBody className="space-y-4">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ))}
            </CardBody>
            <CardFooter>
                <Skeleton className="h-10 w-36" />
            </CardFooter>
        </Card>
    );
}

export function ProfilePageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-4 w-80" />
            </div>
            <div className="grid items-start gap-6 md:grid-cols-2">
                <FormCardSkeleton rows={3} />
                <FormCardSkeleton rows={3} />
            </div>
            <FormCardSkeleton rows={3} />
        </div>
    );
}
