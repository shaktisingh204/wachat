import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { EmailSegmentsClient } from '@/components/email/audience/segments-client';

function SegmentsFallback() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true" aria-label="Loading segments">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-64 w-full" />
      <span className="sr-only">Loading segments</span>
    </div>
  );
}

export default function EmailSegmentsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<SegmentsFallback />}>
        <EmailSegmentsClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
