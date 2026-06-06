'use client';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Skeleton,
} from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div
      className="flex w-full flex-col gap-4"
      aria-busy="true"
      aria-live="polite"
    >
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Subscriptions Billing</PageTitle>
          <PageDescription>Loading subscriptions, one moment.</PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton width={180} height={18} />
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton circle width={36} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton width="40%" height={14} />
                  <Skeleton width="65%" height={12} />
                </div>
                <Skeleton width={88} height={28} radius={8} />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
