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
  Alert,
  ZoruAlertDescription,
} from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';
import { WebhooksClient } from './_WebhooksClient';

export const dynamic = 'force-dynamic';

export default async function WebhooksPage(): Promise<JSX.Element> {
  const [subsRes, deliveriesRes] = await Promise.all([
    listWebhookSubscriptions(),
    listWebhookDeliveries(undefined, 50),
  ]);
  const initialSubs = subsRes.success ? subsRes.subs : [];
  const initialDeliveries = deliveriesRes.success ? deliveriesRes.deliveries : [];
  const loadError = !subsRes.success
    ? subsRes.error
    : !deliveriesRes.success
      ? deliveriesRes.error
      : null;

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

      {loadError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertDescription>{loadError}</ZoruAlertDescription>
        </Alert>
      ) : null}

      <WebhooksClient initialSubs={initialSubs} initialDeliveries={initialDeliveries} />
    </div>
  );
}
