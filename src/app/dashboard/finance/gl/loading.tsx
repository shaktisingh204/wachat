import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  WaterLoaderScreen,
} from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Multi-Currency GL</PageTitle>
          <PageDescription>View general ledger entries.</PageDescription>
        </PageHeaderHeading>
      </PageHeader>
      <WaterLoaderScreen inline caption="Loading general ledger" label="Loading general ledger" />
    </div>
  );
}
