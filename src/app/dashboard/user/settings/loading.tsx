import { Card, CardBody, Separator, Skeleton } from '@/components/sabcrm/20ui';

export default function SettingsLoading() {
    return (
        <div className="flex max-w-[880px] flex-col gap-6">
            <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-44" />
                <Skeleton className="h-4 w-72" />
            </div>
            <Card padding="none">
                {[0, 1, 2].map((i) => (
                    <div key={i}>
                        {i > 0 ? <Separator /> : null}
                        <CardBody>
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-9 w-9 rounded-[var(--st-radius)]" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-56" />
                                </div>
                                <Skeleton className="h-4 w-4" />
                            </div>
                        </CardBody>
                    </div>
                ))}
            </Card>
        </div>
    );
}
