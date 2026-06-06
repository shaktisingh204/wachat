import { Suspense } from 'react';
import { Skeleton, PageHeader, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription, Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
import { EmailSuiteLayout } from '@/components/email/layout';
import { TagsClient } from '@/components/email/audience/tags-client';
import { Tag } from 'lucide-react';

function TagsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <Tag className="h-6 w-6" /> Tags
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Organize subscribers with tags that drive segments and journey triggers.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>All Tags</ZoruCardTitle>
          <ZoruCardDescription>A list of all tags currently assigned to your audience.</ZoruCardDescription>
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

export default function EmailTagsPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<TagsSkeleton />}>
        <TagsClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
