import { Suspense } from 'react';
import { ZoruSkeleton } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { EmailSubscribersClient } from '@/components/email/audience/subscribers-client';

export default function EmailAudiencePage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<ZoruSkeleton className="h-96 w-full" />}>
        <EmailSubscribersClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
