import { Suspense } from 'react';
import { Skeleton, PageHeader, PageHeading, PageTitle, PageDescription, Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/sabcrm/20ui/compat';
import { EmailSuiteLayout } from '@/components/email/layout';
import { TagsClient } from '@/components/email/audience/tags-client';
import { Tag } from 'lucide-react';

function TagsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-3">
              <Tag className="h-6 w-6" /> Tags
            </span>
          </PageTitle>
          <PageDescription>
            Organize subscribers with tags that drive segments and journey triggers.
          </PageDescription>
        </PageHeading>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>All Tags</CardTitle>
          <CardDescription>A list of all tags currently assigned to your audience.</CardDescription>
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

export default function EmailTagsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<TagsSkeleton />}>
        <TagsClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
