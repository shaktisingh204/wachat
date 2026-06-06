/**
 * SabCheckout subscriptions table — `/dashboard/sabcheckout/subscriptions`.
 *
 * Lists every subscription record with a row-level cancel action.
 */
import { Download } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle, PageHeader, PageHeading, PageTitle, PageDescription, Button } from '@/components/sabcrm/20ui/compat';

import { listSabcheckoutSubscriptions } from '@/app/actions/sabcheckout.actions';
import { SubscriptionsClient } from './subscriptions-client';

export const dynamic = 'force-dynamic';

export default async function SabcheckoutSubscriptionsPage() {
  const res = await listSabcheckoutSubscriptions({ status: 'all', limit: 100 });

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <PageHeading>
            <PageTitle>Subscriptions</PageTitle>
            <PageDescription>
              Active, past-due, paused, or cancelled subscriptions.
            </PageDescription>
          </PageHeading>
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
          <CardHeader>
            <CardTitle>Couldn't load subscriptions</CardTitle>
            <CardDescription>{res.error}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <SubscriptionsClient initial={res.data.items} />
      )}
    </div>
  );
}
