import { SabpayPage } from '../_components/sabpay-page';
import { getSabpayWebhookData } from '../actions';
import { WebhooksClient } from './webhooks-client';

export const dynamic = 'force-dynamic';

export default async function SabpayWebhooksPage() {
  const data = await getSabpayWebhookData();

  return (
    <SabpayPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'SabPay', href: '/sabpay' },
        { label: 'Webhooks' },
      ]}
      title="Webhooks"
      description="We POST a signed event to your endpoints on every payment change — retried with backoff, auto-disabled after 10 straight failures."
      width="wide"
    >
      <WebhooksClient initialData={data} />
    </SabpayPage>
  );
}
