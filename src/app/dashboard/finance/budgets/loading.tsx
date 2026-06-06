import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Skeleton,
} from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="ui20 flex w-full flex-col gap-4">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Budget vs Actuals</PageTitle>
          <PageDescription>Track budgets and view actuals.</PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="space-y-2" aria-live="polite" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
