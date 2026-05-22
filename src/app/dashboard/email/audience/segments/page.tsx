import { Suspense } from 'react';
import { Skeleton } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { EmailSegmentsClient } from '@/components/email/audience/segments-client';

export default function EmailSegmentsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<ZoruSkeleton className="h-96 w-full" />}>
        <EmailSegmentsClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
