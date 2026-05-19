import { Suspense } from 'react';
import { ZoruSkeleton, RouteComingSoon } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';

export default function EmailFormsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<ZoruSkeleton className="h-96 w-full" />}>
        <RouteComingSoon
          title="Forms"
          description="Signup forms, popups and hosted landing pages."
          parentHref="/dashboard/email"
          parentLabel="Back to email overview"
        />
      </Suspense>
    </EmailSuiteLayout>
  );
}
