/**
 * SabCheckout plans CRUD — `/dashboard/sabcheckout/plans`.
 *
 * Server-fetches all plans for the signed-in user and hands off to a
 * thin client component that owns the create/edit/archive forms.
 */
import { Card, CardDescription, CardHeader, CardTitle, PageHeader, PageHeading, PageTitle, PageDescription } from '@/components/sabcrm/20ui';

import { listSabcheckoutPlans } from '@/app/actions/sabcheckout.actions';
import { SabcheckoutPlansClient } from './plans-client';

export const dynamic = 'force-dynamic';

export default async function SabcheckoutPlansPage() {
  const res = await listSabcheckoutPlans({ status: 'all', limit: 100 });
  const plans = res.ok ? res.data.items : [];

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Plans</PageTitle>
          <PageDescription>
            Recurring billing templates referenced by your payment pages.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      {!res.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn't load plans</CardTitle>
            <CardDescription>{res.error}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <SabcheckoutPlansClient initial={plans} />
      )}
    </div>
  );
}
