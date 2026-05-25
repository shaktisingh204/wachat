import React, { Suspense } from 'react';
import { getPerformanceReviews } from '@/app/actions/hrm-advanced/performance-reviews';
import { PerformanceReviewsClient } from './client-page';
import Loading from './loading';

export const dynamic = 'force-dynamic';


export const metadata = {
  title: 'Performance 360 Reviews | HRM Advanced',
  description: 'Manage and evaluate employee performance reviews',
};

async function PerformanceReviewsData() {
  const data = await getPerformanceReviews();
  return <PerformanceReviewsClient initialData={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PerformanceReviewsData />
    </Suspense>
  );
}
