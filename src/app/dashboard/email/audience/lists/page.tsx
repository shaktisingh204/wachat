import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { EmailListsClient } from '@/components/email/audience/lists-client';

export default function EmailListsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense
        fallback={
          <Skeleton
            className="h-96 w-full"
            role="status"
            aria-label="Loading audience lists"
          />
        }
      >
        <EmailListsClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
