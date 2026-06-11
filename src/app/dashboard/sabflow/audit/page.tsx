import { Suspense } from 'react';
import { Spinner } from '@/components/sabcrm/20ui';
import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';
import { AuditClient } from './_components/audit-client';

export default function SabflowAuditPage() {
  return (
    <SabflowPage
      breadcrumb={[...SABFLOW_CRUMBS, { label: 'Audit Log' }]}
      eyebrow="Security & Compliance"
      title="Audit Log"
      description="Who changed what across your SabFlow workspace — flows, credentials, API keys, env vars, and folders."
    >
      <Suspense fallback={<Spinner />}>
        <AuditClient />
      </Suspense>
    </SabflowPage>
  );
}
