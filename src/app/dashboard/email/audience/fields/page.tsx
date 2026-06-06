import { Suspense } from 'react';
import { Skeleton, PageHeader, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription, Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
import { EmailSuiteLayout } from '@/components/email/layout';
import { FieldsClient } from '@/components/email/audience/fields-client';
import { Database } from 'lucide-react';

function FieldsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <Database className="h-6 w-6" /> Custom Fields
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Manage custom data fields for your subscribers.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Schema Definition</ZoruCardTitle>
          <ZoruCardDescription>Current custom fields configured for your account.</ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="space-y-2">
             <Skeleton className="h-10 w-full" />
             <Skeleton className="h-10 w-full" />
             <Skeleton className="h-10 w-full" />
          </div>
        </ZoruCardContent>
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
