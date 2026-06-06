import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { SegmentBuilderClient } from '@/components/email/segments/segment-builder-client';

export const dynamic = 'force-dynamic';

export default function NewEmailSegmentPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <SegmentBuilderClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
