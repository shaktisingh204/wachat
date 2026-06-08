import React from 'react';
import { Skeleton, Card, CardBody } from '@/components/sabcrm/20ui';

export default function SabworkerlyLoading() {
    return (
        <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6">
            <div className="flex flex-col gap-2">
                <Skeleton width={96} height={14} />
                <Skeleton width={220} height={26} />
                <Skeleton width={320} height={14} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardBody className="flex flex-col gap-3">
                            <Skeleton width={32} height={32} radius={8} />
                            <Skeleton width={96} height={12} />
                            <Skeleton width={64} height={22} />
                        </CardBody>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i}>
                        <CardBody className="flex flex-col gap-3">
                            <Skeleton width={160} height={16} />
                            <Skeleton height={40} />
                            <Skeleton height={40} />
                            <Skeleton height={40} />
                        </CardBody>
                    </Card>
                ))}
            </div>
        </div>
    );
}
