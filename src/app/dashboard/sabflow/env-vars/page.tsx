import { Suspense } from 'react';
import { Spinner } from '@/components/sabcrm/20ui';
import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';
import { EnvVarsClient } from './_components/env-vars-client';

export default function EnvVarsPage() {
  return (
    <SabflowPage
      breadcrumb={[...SABFLOW_CRUMBS, { label: 'Environment Variables' }]}
      title="Environment Variables"
      description="Securely manage workspace variables and secrets. Reference them in any flow expression as $env.KEY."
    >
      <Suspense fallback={<Spinner />}>
        <EnvVarsClient />
      </Suspense>
    </SabflowPage>
  );
}
