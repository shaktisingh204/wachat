import React from 'react';
import {
  Card,
  CardBody,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Skeleton,
} from '@/components/sabcrm/20ui';

export default function Loading(): React.JSX.Element {
  return (
    <div
      className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading financial overview"
    >
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Finance</PageEyebrow>
          <PageTitle>Financial overview</PageTitle>
          <PageDescription>Loading your latest figures.</PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} variant="outlined">
            <CardBody className="flex flex-col gap-3">
              <Skeleton className="h-8 w-8" radius="var(--st-radius)" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-32" />
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card variant="outlined" className="lg:col-span-2">
          <CardBody>
            <Skeleton className="h-[280px] w-full" radius="var(--st-radius)" />
          </CardBody>
        </Card>
        <Card variant="outlined">
          <CardBody className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <span className="sr-only">Loading financial overview</span>
    </div>
  );
}
