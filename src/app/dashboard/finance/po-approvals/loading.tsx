import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Skeleton,
} from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>PO Approvals</PageTitle>
        </PageHeaderHeading>
      </PageHeader>

      <div
        className="space-y-2"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading PO approvals"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={48} className="w-full" />
        ))}
      </div>
    </div>
  );
}
