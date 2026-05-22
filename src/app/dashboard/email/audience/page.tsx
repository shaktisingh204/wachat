import { Suspense } from 'react';
import { Skeleton } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { EmailSubscribersClient } from '@/components/email/audience/subscribers-client';

export default function EmailAudiencePage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <EmailSubscribersClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
