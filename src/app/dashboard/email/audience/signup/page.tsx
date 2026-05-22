import { Suspense } from 'react';
import { Skeleton, RouteComingSoon } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';

export default function EmailSignupFormsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<ZoruSkeleton className="h-96 w-full" />}>
        <RouteComingSoon
          title="Audience · Signup forms"
          description="Embedded forms, popups and hosted landing pages for collecting subscribers."
          parentHref="/dashboard/email/audience"
          parentLabel="Back to audience"
        />
      </Suspense>
    </EmailSuiteLayout>
  );
}
