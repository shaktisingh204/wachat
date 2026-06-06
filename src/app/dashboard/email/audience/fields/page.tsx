import { Suspense } from 'react';
import { Skeleton, PageHeader, PageHeading, PageTitle, PageDescription, Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/sabcrm/20ui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { FieldsClient } from '@/components/email/audience/fields-client';
import { Database } from 'lucide-react';

function FieldsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-3">
              <Database className="h-6 w-6" /> Custom Fields
            </span>
          </PageTitle>
          <PageDescription>
            Manage custom data fields for your subscribers.
          </PageDescription>
        </PageHeading>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Schema Definition</CardTitle>
          <CardDescription>Current custom fields configured for your account.</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="space-y-2">
             <Skeleton className="h-10 w-full" />
             <Skeleton className="h-10 w-full" />
             <Skeleton className="h-10 w-full" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default function EmailFieldsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<FieldsSkeleton />}>
        <FieldsClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
