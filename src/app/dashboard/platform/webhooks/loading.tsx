import {
  Card,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Skeleton,
} from '@/components/sabcrm/20ui';

export default function WebhooksLoading() {
  return (
    <div
      className="ui20 flex w-full flex-col gap-4 p-4 md:p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading webhooks and Zapier integrations</span>

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Webhooks &amp; Zapier Integrations</PageTitle>
          <PageDescription>
            Connect SabNode to external apps using webhooks.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card padding="none">
        <div className="flex flex-col divide-y divide-[var(--st-border)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3.5"
            >
              <Skeleton circle width={36} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton width="40%" height={14} />
                <Skeleton width="65%" height={12} />
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
