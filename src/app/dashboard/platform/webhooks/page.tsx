import { getWebhooks } from '@/app/actions/platform/webhooks.actions';
import WebhooksClient from './webhooks-client';

export const metadata = {
  title: 'Webhooks | SabNode Platform',
};

export const dynamic = 'force-dynamic';

export default async function WebhooksPage() {
  const initialData = await getWebhooks();
  
  return <WebhooksClient initialData={initialData} />;
}
