export const dynamic = "force-dynamic";

import { Suspense } from 'react';
import { getCustomObjects } from '@/app/actions/platform/custom-object-builder.actions';
import { CustomObjectClient } from './client';
import {
  Card,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Skeleton,
} from '@/components/sabcrm/20ui';

function CustomObjectsFallback() {
  return (
    <div className="20ui flex w-full flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading custom objects</span>
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Platform</PageEyebrow>
          <PageTitle>Custom objects</PageTitle>
          <PageDescription>
            Model the data unique to your business with custom objects and fields.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} padding="md">
            <Skeleton width={36} height={36} radius={8} />
            <Skeleton width="50%" height={12} className="mt-3" />
            <Skeleton width="35%" height={20} className="mt-2" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} padding="lg">
            <Skeleton width={44} height={44} radius={10} />
            <Skeleton width="55%" height={16} className="mt-3" />
            <Skeleton width="40%" height={12} className="mt-2" />
            <Skeleton width="80%" height={12} className="mt-4" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export default async function CustomObjectBuilderPage() {
  return (
    <Suspense fallback={<CustomObjectsFallback />}>
      <CustomObjectBuilderData />
    </Suspense>
  );
}

async function CustomObjectBuilderData() {
  const data = await getCustomObjects();
  return <CustomObjectClient initialData={data} />;
}
