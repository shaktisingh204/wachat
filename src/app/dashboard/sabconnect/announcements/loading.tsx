'use client';

import * as React from 'react';
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Card,
  CardBody,
  Skeleton,
} from '@/components/sabcrm/20ui';

export default function AnnouncementsLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Announcements</PageTitle>
          <PageDescription>
            Broadcast updates, schedule rollouts, and track who has acknowledged.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Skeleton width={120} height={36} radius={8} />
        </PageActions>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <Skeleton width={220} height={36} radius={8} />
        <Skeleton width={140} height={36} radius={8} />
        <Skeleton width={140} height={36} radius={8} />
      </div>

      <Card variant="outlined" padding="none">
        <CardBody className="flex flex-col gap-0 p-0">
          <div className="flex items-center gap-4 border-b border-[var(--st-border)] px-4 py-3">
            <Skeleton width={20} height={20} radius={4} />
            <Skeleton width="30%" height={14} radius={4} />
            <Skeleton width="20%" height={14} radius={4} />
            <Skeleton width="15%" height={14} radius={4} />
            <Skeleton width="15%" height={14} radius={4} />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-[var(--st-border)] px-4 py-4 last:border-b-0"
            >
              <Skeleton width={20} height={20} radius={4} />
              <Skeleton width="30%" height={16} radius={4} />
              <Skeleton width="20%" height={16} radius={4} />
              <Skeleton width="15%" height={16} radius={4} />
              <Skeleton width="15%" height={16} radius={4} />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
