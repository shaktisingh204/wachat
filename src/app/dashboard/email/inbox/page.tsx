import { Suspense } from 'react';

import { Skeleton } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { EmailInboxClient } from '@/components/email/inbox';

export default function EmailInboxPage() {
  return (
    <EmailSuiteLayout>
      <Suspense
        fallback={<ZoruSkeleton className="h-[640px] w-full rounded-[var(--zoru-radius-lg)]" />}
      >
        <EmailInboxClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
