import { Card, CardHeader, CardBody, CardFooter, Separator, Skeleton } from '@/components/sabcrm/20ui';

function SettingRowSkeleton({ controlWidth = 'w-32' }: { controlWidth?: string }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className={`h-9 ${controlWidth}`} />
        </div>
    );
}

export function UIPageSkeleton() {
    return (
        <div className="flex max-w-[720px] flex-col gap-6">
            <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-72" />
            </div>
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-[26px] w-[26px] rounded-[var(--st-radius)]" />
                        <Skeleton className="h-5 w-28" />
                    </div>
                    <Skeleton className="mt-2 h-4 w-60" />
                </CardHeader>
                <CardBody className="space-y-4">
                    <SettingRowSkeleton controlWidth="w-40" />
                    <Separator />
                    <SettingRowSkeleton controlWidth="w-56" />
                </CardBody>
                <CardFooter className="justify-end">
                    <Skeleton className="h-9 w-36" />
                </CardFooter>
            </Card>
        </div>
    );
}
