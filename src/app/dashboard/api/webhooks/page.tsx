import {
  listWebhookSubscriptions,
  listWebhookDeliveries,
} from '@/app/actions/developer-platform.actions';
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
    <div className="max-w-5xl mx-auto px-6 py-8">
      <header className="mb-6">
        <a href="/dashboard/api" className="text-xs text-amber-300 hover:text-amber-200">
          ← Developer platform
        </a>
        <h1 className="text-3xl font-bold mt-2">Webhooks</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Outbound HMAC-signed deliveries. Retries follow{' '}
          <code>0s → 30s → 5m → 1h → 6h → 24h</code>; the worker auto-pauses a subscription
          after 50 consecutive failures.
        </p>
      </header>
      {loadError ? (
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {loadError}
        </div>
      ) : null}
      <WebhooksClient initialSubs={initialSubs} initialDeliveries={initialDeliveries} />
    </div>
  );
}
