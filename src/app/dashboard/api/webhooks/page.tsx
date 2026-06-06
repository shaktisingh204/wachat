import {
  listWebhookSubscriptions,
  listWebhookDeliveries,
} from '@/app/actions/developer-platform.actions';
import { PageHeader, PageHeading, PageTitle, PageDescription, Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/sabcrm/20ui';
import { WebhooksClient } from './_WebhooksClient';

export const dynamic = 'force-dynamic';

export default async function WebhooksPage(): Promise<JSX.Element> {
  const [subsRes, deliveriesRes] = await Promise.all([
    listWebhookSubscriptions(),
    listWebhookDeliveries(undefined, 50),
  ]);

  if (!subsRes.success) {
    throw new Error(subsRes.error || 'Failed to list webhook subscriptions');
  }
  
  if (!deliveriesRes.success) {
    throw new Error(deliveriesRes.error || 'Failed to list webhook deliveries');
  }

  const initialSubs = subsRes.subs || [];
  const initialDeliveries = deliveriesRes.deliveries || [];

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/api">Developer platform</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Webhooks</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Webhooks</PageTitle>
          <PageDescription>
            Outbound HMAC-signed deliveries. Retries follow{' '}
            <code className="font-mono">0s → 30s → 5m → 1h → 6h → 24h</code>; the worker
            auto-pauses a subscription after 50 consecutive failures.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <WebhooksClient initialSubs={initialSubs} initialDeliveries={initialDeliveries} />
    </div>
  );
}
