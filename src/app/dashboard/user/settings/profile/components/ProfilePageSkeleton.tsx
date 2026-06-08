import { Card, CardBody, CardFooter, CardHeader, Skeleton } from '@/components/sabcrm/20ui';

function FormCardSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-[26px] w-[26px] rounded-[var(--st-radius)]" />
                    <Skeleton className="h-5 w-36" />
                </div>
                <Skeleton className="mt-2 h-4 w-64" />
            </CardHeader>
            <CardBody className="space-y-4">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                ))}
            </CardBody>
            <CardFooter className="justify-end">
                <Skeleton className="h-9 w-36" />
            </CardFooter>
        </Card>
    );
}

export function ProfilePageSkeleton() {
    return (
        <div className="flex max-w-[960px] flex-col gap-6">
            <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-4 w-80" />
            </div>
            <div className="grid items-start gap-5 lg:grid-cols-2">
                <FormCardSkeleton rows={3} />
                <FormCardSkeleton rows={3} />
            </div>
            <FormCardSkeleton rows={3} />
        </div>
    );
}
