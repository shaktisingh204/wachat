import { Suspense } from 'react';
import { Skeleton } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { EmailCampaignsClient } from '@/components/email/campaigns/campaigns-client';

export default function EmailCampaignsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<ZoruSkeleton className="h-96 w-full" />}>
        <EmailCampaignsClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
