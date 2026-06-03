/**
 * SabCheckout plans CRUD — `/dashboard/sabcheckout/plans`.
 *
 * Server-fetches all plans for the signed-in user and hands off to a
 * thin client component that owns the create/edit/archive forms.
 */
import {
  Card,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription
} from '@/components/zoruui';

import { listSabcheckoutPlans } from '@/app/actions/sabcheckout.actions';
import { SabcheckoutPlansClient } from './plans-client';

export const dynamic = 'force-dynamic';

export default async function SabcheckoutPlansPage() {
  const res = await listSabcheckoutPlans({ status: 'all', limit: 100 });
  const plans = res.ok ? res.data.items : [];

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Plans</ZoruPageTitle>
          <ZoruPageDescription>
            Recurring billing templates referenced by your payment pages.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {!res.ok ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Couldn't load plans</ZoruCardTitle>
            <ZoruCardDescription>{res.error}</ZoruCardDescription>
          </ZoruCardHeader>
        </Card>
      ) : (
        <SabcheckoutPlansClient initial={plans} />
      )}
    </div>
  );
}
