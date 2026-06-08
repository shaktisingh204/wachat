import {
  listWebhookSubscriptions,
  listWebhookDeliveries,
} from '@/app/actions/developer-platform.actions';
import {
  PageHeader,
  PageHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  StatCard,
} from '@/components/sabcrm/20ui';
import { Webhook, CheckCircle2, Send, TriangleAlert } from 'lucide-react';
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

  const activeSubs = initialSubs.filter((s) => s.status === 'active').length;
  const failedDeliveries = initialDeliveries.filter((d) => d.status === 'failed').length;

  return (
    <div className="20ui flex min-h-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageEyebrow>Developer platform</PageEyebrow>
          <PageTitle>Webhooks</PageTitle>
          <PageDescription>
            Outbound HMAC-signed deliveries. Retries follow{' '}
            <code className="font-mono text-[var(--st-text)]">0s, 30s, 5m, 1h, 6h, 24h</code>, then
            the worker auto-pauses a subscription after 50 consecutive failures.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Subscriptions"
          value={String(initialSubs.length)}
          icon={<Webhook />}
          accent="#3b7af5"
        />
        <StatCard label="Active" value={String(activeSubs)} icon={<CheckCircle2 />} accent="#1f9d55" />
        <StatCard
          label="Deliveries"
          value={String(initialDeliveries.length)}
          icon={<Send />}
          accent="#7c3aed"
        />
        <StatCard
          label="Failed"
          value={String(failedDeliveries)}
          icon={<TriangleAlert />}
          accent="#d97706"
        />
      </div>

      <WebhooksClient initialSubs={initialSubs} initialDeliveries={initialDeliveries} />
    </div>
  );
}
