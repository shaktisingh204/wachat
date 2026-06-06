'use client';

import {
  Card,
  CardBody,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Skeleton,
} from '@/components/sabcrm/20ui';

/**
 * Route-level loading skeleton for the Direct Payouts list. Built on 20ui
 * primitives: a PageHeader title block over a Card holding shimmer rows that
 * mirror the shape of the payouts table about to render.
 */
export default function Loading() {
  return (
    <div
      className="flex w-full flex-col gap-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading Direct Payouts"
    >
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Direct Payouts</PageTitle>
          <PageDescription>Loading payouts.</PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card>
        <CardBody className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="3rem" className="w-full" />
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
