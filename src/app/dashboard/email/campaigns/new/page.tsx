import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { CampaignWizard } from '@/components/email/campaigns/wizard/campaign-wizard';

export const dynamic = 'force-dynamic';

export default function NewEmailCampaignPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CampaignWizard />
      </Suspense>
    </EmailSuiteLayout>
  );
}
