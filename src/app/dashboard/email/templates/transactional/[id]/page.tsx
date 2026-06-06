import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EmailSuiteLayout } from '@/components/email/layout';
import { TransactionalTemplateForm } from '@/components/email/templates/transactional/transactional-template-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTransactionalTemplatePage({ params }: PageProps) {
  const { id } = await params;
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <TransactionalTemplateForm mode="edit" templateId={id} />
      </Suspense>
    </EmailSuiteLayout>
  );
}
