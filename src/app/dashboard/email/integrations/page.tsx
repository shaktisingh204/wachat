import { Suspense } from 'react';
import { ZoruSkeleton, RouteComingSoon } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';

export default function EmailIntegrationsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<ZoruSkeleton className="h-96 w-full" />}>
        <RouteComingSoon
          title="Integrations"
          description="Provider connections, outbound webhooks, OAuth apps, and API keys."
          parentHref="/dashboard/email"
          parentLabel="Back to email overview"
        />
      </Suspense>
    </EmailSuiteLayout>
  );
}
