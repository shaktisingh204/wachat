import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Skeleton,
} from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Multi-Warehouse Inventory</PageTitle>
          <PageDescription>Manage inventory items.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Skeleton width={120} height={36} radius={8} />
        </PageActions>
      </PageHeader>

      <div
        className="flex flex-col gap-2"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading inventory items"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={48} radius={8} className="w-full" />
        ))}
      </div>
    </div>
  );
}
