import { Suspense } from 'react';
import { ZoruSkeleton, RouteComingSoon } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';

export default function EmailAudiencePage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<ZoruSkeleton className="h-96 w-full" />}>
        <RouteComingSoon
          title="Audience"
          description="Lists, segments, tags, custom fields and signup forms — shipping in Phase 1 of the email rebuild."
          parentHref="/dashboard/email"
          parentLabel="Back to email overview"
        />
      </Suspense>
    </EmailSuiteLayout>
  );
}
