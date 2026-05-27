/**
 * SabCheckout plans CRUD — `/dashboard/sabcheckout/plans`.
 *
 * Server-fetches all plans for the signed-in user and hands off to a
 * thin client component that owns the create/edit/archive forms.
 */
import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';

import { listSabcheckoutPlans } from '@/app/actions/sabcheckout.actions';
import { SabcheckoutPlansClient } from './plans-client';

export const dynamic = 'force-dynamic';

export default async function SabcheckoutPlansPage() {
  const res = await listSabcheckoutPlans({ status: 'all', limit: 100 });
  const plans = res.ok ? res.data.items : [];

  return (
    <div className="zoruui space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
        <p className="text-sm text-[var(--zoru-muted-fg)]">
          Recurring billing templates referenced by your payment pages.
        </p>
      </header>

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
