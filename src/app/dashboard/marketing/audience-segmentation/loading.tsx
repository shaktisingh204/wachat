import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Skeleton,
} from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="20ui mx-auto flex w-full max-w-[1180px] flex-col gap-[var(--st-space-5)] px-6 py-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Marketing</PageEyebrow>
          <PageTitle>Audience segmentation</PageTitle>
          <PageDescription>
            Group your contacts into reusable segments to target campaigns more precisely.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        <Skeleton className="h-24 w-full" radius={12} />
      </div>

      <div className="space-y-2" aria-busy="true" aria-live="polite">
        <Skeleton className="h-12 w-full" radius={8} />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" radius={8} />
        ))}
      </div>
    </div>
  );
}
