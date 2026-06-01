'use client';

import {
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  Card,
  Skeleton,
} from '@/components/zoruui';

/**
 * SabCRM root loading skeleton.
 *
 * Matches the overview/index layout: page header + grid of object cards.
 * Each card shows a title, description, badge, and record count.
 */
export default function SabcrmLoading() {
  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Customer relationships</ZoruPageEyebrow>
          <ZoruPageTitle>SabCRM</ZoruPageTitle>
          <ZoruPageDescription>
            Your data, organised by object. Open any object to browse, filter
            and manage its records.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex">
            <Card variant="soft" className="flex h-full w-full flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-12" />
              </div>
              <Skeleton className="h-10 w-full" />
              <div className="mt-auto flex items-center gap-2 pt-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
