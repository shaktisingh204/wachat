/**
 * SabCheckout subscriptions table — `/dashboard/sabcheckout/subscriptions`.
 *
 * Lists every subscription record with a row-level cancel action.
 */
import { Download } from 'lucide-react';

import {
  Card,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  Button
} from '@/components/sabcrm/20ui/compat';

import { listSabcheckoutSubscriptions } from '@/app/actions/sabcheckout.actions';
import { SubscriptionsClient } from './subscriptions-client';

export const dynamic = 'force-dynamic';

export default async function SabcheckoutSubscriptionsPage() {
  const res = await listSabcheckoutSubscriptions({ status: 'all', limit: 100 });

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Subscriptions</ZoruPageTitle>
            <ZoruPageDescription>
              Active, past-due, paused, or cancelled subscriptions.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

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
