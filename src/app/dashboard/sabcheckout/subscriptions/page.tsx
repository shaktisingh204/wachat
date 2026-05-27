/**
 * SabCheckout subscriptions table — `/dashboard/sabcheckout/subscriptions`.
 *
 * Lists every subscription record with a row-level cancel action.
 */
import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';

import { listSabcheckoutSubscriptions } from '@/app/actions/sabcheckout.actions';
import { SubscriptionsClient } from './subscriptions-client';

export const dynamic = 'force-dynamic';

export default async function SabcheckoutSubscriptionsPage() {
  const res = await listSabcheckoutSubscriptions({ status: 'all', limit: 100 });

  return (
    <div className="zoruui space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-[var(--zoru-muted-fg)]">
          Active, past-due, paused, or cancelled subscriptions.
        </p>
      </header>

      {!res.ok ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Couldn't load subscriptions</ZoruCardTitle>
            <ZoruCardDescription>{res.error}</ZoruCardDescription>
          </ZoruCardHeader>
        </Card>
      ) : (
        <SubscriptionsClient initial={res.data.items} />
      )}
    </div>
  );
}
