import { Card, CardHeader, CardBody, Skeleton } from '@/components/sabcrm/20ui';

export default function SettingsLoading() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-72" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="mt-2 h-4 w-full" />
                        </CardHeader>
                        <CardBody>
                            <Skeleton className="h-10 w-full" />
                        </CardBody>
                    </Card>
                ))}
            </div>
        </div>
    );
}
