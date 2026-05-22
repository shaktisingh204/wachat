import { Suspense } from 'react';
import { Skeleton } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { EmailListsClient } from '@/components/email/audience/lists-client';

export default function EmailListsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<ZoruSkeleton className="h-96 w-full" />}>
        <EmailListsClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
