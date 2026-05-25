import {
  listWebhookSubscriptions,
  listWebhookDeliveries,
} from '@/app/actions/developer-platform.actions';
import {
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  Breadcrumb,
  ZoruBreadcrumbList,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbSeparator,
  ZoruBreadcrumbPage,
} from '@/components/zoruui';
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
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/api">Developer platform</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Webhooks</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Webhooks</ZoruPageTitle>
          <ZoruPageDescription>
            Outbound HMAC-signed deliveries. Retries follow{' '}
            <code className="font-mono">0s → 30s → 5m → 1h → 6h → 24h</code>; the worker
            auto-pauses a subscription after 50 consecutive failures.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <WebhooksClient initialSubs={initialSubs} initialDeliveries={initialDeliveries} />
    </div>
  );
}
