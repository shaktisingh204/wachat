import { Suspense } from 'react';
import { Skeleton, RouteComingSoon } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';

export default function EmailTagsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <RouteComingSoon
          title="Audience · Tags"
          description="Organize subscribers with tags that drive segments and journey triggers."
          parentHref="/dashboard/email/audience"
          parentLabel="Back to audience"
        />
      </Suspense>
    </EmailSuiteLayout>
  );
}
