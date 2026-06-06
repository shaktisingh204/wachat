import { Suspense } from 'react';
import { Skeleton, PageHeader, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription, ZoruPageActions, Button, Card } from '@/components/sabcrm/20ui/compat';
import { EmailSuiteLayout } from '@/components/email/layout';
import { JourneysClient } from '@/components/email/journeys/journeys-client';
import { GitBranch, Plus } from 'lucide-react';

function JourneysSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <GitBranch className="h-6 w-6" /> Journeys
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Build behavioural &amp; lifecycle journeys with the visual canvas.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button disabled>
            <Plus className="h-4 w-4" /> New journey
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">Your journeys</h2>
        <Card className="divide-y divide-[var(--st-border)]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">Start from a template</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
             <Card key={i} className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                     <Skeleton className="h-5 w-3/4" />
                     <Skeleton className="h-4 w-full" />
                  </div>
                </div>
             </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function EmailJourneysPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<JourneysSkeleton />}>
        <JourneysClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
