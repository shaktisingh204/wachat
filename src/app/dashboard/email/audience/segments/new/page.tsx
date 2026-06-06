import { Suspense } from 'react';

import { Skeleton } from '@/components/sabcrm/20ui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { SegmentBuilderClient } from '@/components/email/segments/segment-builder-client';

export const dynamic = 'force-dynamic';

export default function NewEmailSegmentPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<Skeleton height="24rem" className="w-full" />}>
        <SegmentBuilderClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
