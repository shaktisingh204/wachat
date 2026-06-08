import {
  Card,
  CardHeader,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Skeleton,
} from '@/components/sabcrm/20ui';

export default function WebhooksLoading() {
  return (
    <div
      className="20ui flex w-full flex-col gap-5"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading webhooks and Zapier integrations</span>

      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Platform</PageEyebrow>
          <PageTitle>Webhooks &amp; Zapier</PageTitle>
          <PageDescription>
            Push SabNode events to external apps in real time.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} padding="md">
            <Skeleton width={36} height={36} radius={8} />
            <Skeleton width="50%" height={12} className="mt-3" />
            <Skeleton width="35%" height={20} className="mt-2" />
          </Card>
        ))}
      </div>

      <Card padding="none">
        <CardHeader className="border-b border-[var(--st-border)]">
          <Skeleton width={120} height={16} />
        </CardHeader>
        <div className="flex flex-col divide-y divide-[var(--st-border)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton width="30%" height={14} />
                <Skeleton width="55%" height={12} />
              </div>
              <Skeleton width={72} height={22} radius={999} />
              <Skeleton width={88} height={32} radius={8} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
