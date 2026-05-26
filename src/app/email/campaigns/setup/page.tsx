import { Suspense } from 'react';
import { SetupWizardClient } from './setup-wizard-client';
import { actionListEmailLists, actionListEmailSegments } from '@/app/actions/email/audience.actions';
import { Skeleton } from '@/components/zoruui';

export const metadata = {
  title: 'Campaign Setup',
};

export default async function CampaignSetupPage() {
  const [listsRes, segmentsRes] = await Promise.all([
    actionListEmailLists({ limit: 100 }),
    actionListEmailSegments(),
  ]);

  const lists = listsRes.ok ? listsRes.data.items : [];
  const segments = segmentsRes.ok ? segmentsRes.data : [];

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
        <SetupWizardClient initialLists={lists} initialSegments={segments} />
      </Suspense>
    </div>
  );
}
