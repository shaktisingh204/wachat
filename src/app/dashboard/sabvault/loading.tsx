import { Card, CardBody, Skeleton } from '@/components/sabcrm/20ui';

/** Skeleton matching the vault overview: header, KPI strip, and a table card. */
export default function SabvaultLoading() {
    return (
        <div className="20ui mx-auto flex max-w-6xl flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <Skeleton width={88} height={12} />
                <Skeleton width={180} height={26} />
                <Skeleton width="60%" height={14} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardBody className="flex flex-col gap-3">
                            <Skeleton circle width={32} height={32} />
                            <Skeleton width="70%" height={12} />
                            <Skeleton width="45%" height={22} />
                        </CardBody>
                    </Card>
                ))}
            </div>

            <Card>
                <CardBody className="flex flex-col gap-3">
                    <Skeleton width={160} height={16} />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <Skeleton circle width={28} height={28} />
                            <Skeleton width="40%" height={14} />
                            <Skeleton width="20%" height={14} style={{ marginLeft: 'auto' }} />
                        </div>
                    ))}
                </CardBody>
            </Card>
        </div>
    );
}
