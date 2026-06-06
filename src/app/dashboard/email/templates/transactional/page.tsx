import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EmailSuiteLayout } from '@/components/email/layout';
import { TransactionalTemplatesClient } from '@/components/email/templates/transactional/transactional-templates-client';

export const dynamic = 'force-dynamic';

export default function TransactionalTemplatesPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <TransactionalTemplatesClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
