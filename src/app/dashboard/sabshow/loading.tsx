import { Card, Skeleton } from '@/components/sabcrm/20ui';

export default function SabshowLoading() {
    return (
        <div className="20ui mx-auto w-full max-w-6xl space-y-6 p-6">
            <div className="space-y-2">
                <Skeleton width={72} height={14} />
                <Skeleton width={220} height={28} />
                <Skeleton width={360} height={14} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} padding="md" className="space-y-2">
                        <Skeleton circle width={32} height={32} />
                        <Skeleton width={64} height={12} />
                        <Skeleton width={48} height={24} />
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} padding="md" className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Skeleton width={140} height={16} />
                            <Skeleton width={56} height={20} radius={9999} />
                        </div>
                        <Skeleton width={120} height={12} />
                        <div className="flex gap-2 pt-1">
                            <Skeleton width={64} height={28} />
                            <Skeleton width={64} height={28} />
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
