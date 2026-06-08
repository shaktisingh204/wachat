import * as React from 'react';
import { Card, Skeleton } from '@/components/sabcrm/20ui';

export default function RequestsLoading() {
    return (
        <div className="20ui flex flex-col gap-6 p-6" aria-busy="true">
            <div className="flex flex-col gap-2">
                <Skeleton width={180} height={24} />
                <Skeleton width={360} height={14} />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} padding="md">
                        <div className="flex flex-col gap-3">
                            <Skeleton width={32} height={32} radius={8} />
                            <Skeleton width="60%" height={12} />
                            <Skeleton width={48} height={22} />
                        </div>
                    </Card>
                ))}
            </div>

            <Card padding="md">
                <div className="flex flex-col gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <Skeleton width="40%" height={14} />
                            <Skeleton width={80} height={20} radius={999} />
                            <Skeleton width="20%" height={14} className="ml-auto" />
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
