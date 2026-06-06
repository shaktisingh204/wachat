import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EmailSuiteLayout } from '@/components/email/layout';
import { TransactionalTemplateForm } from '@/components/email/templates/transactional/transactional-template-form';

export const dynamic = 'force-dynamic';

export default function NewTransactionalTemplatePage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <TransactionalTemplateForm mode="create" />
      </Suspense>
    </EmailSuiteLayout>
  );
}
