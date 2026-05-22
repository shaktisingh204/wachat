import { Suspense } from 'react';
import { Skeleton, RouteComingSoon } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';

export default function EmailFieldsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<ZoruSkeleton className="h-96 w-full" />}>
        <RouteComingSoon
          title="Audience · Custom fields"
          description="Define the schema that powers personalisation, merge tags and segment filters."
          parentHref="/dashboard/email/audience"
          parentLabel="Back to audience"
        />
      </Suspense>
    </EmailSuiteLayout>
  );
}
